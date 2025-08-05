/**
 * Enhanced Visualization Debugging Service
 * Provides comprehensive network activity capture similar to Chrome DevTools
 * Captures all resource types with detailed metadata
 */
export class VisualizationDebugger {
    // Enhanced resource type detection patterns with more Chrome DevTools-like categorization
    static RESOURCE_TYPES = {
        document: {
            patterns: [/\.html?$/i, /\/$/],
            contentTypes: ['text/html'],
            icon: '📄',
            color: '#3b82f6',
            priority: 'High'
        },
        stylesheet: {
            patterns: [/\.css$/i],
            contentTypes: ['text/css'],
            icon: '🎨',
            color: '#8b5cf6',
            priority: 'High'
        },
        script: {
            patterns: [/\.js$/i, /\.ts$/i, /\.jsx$/i, /\.tsx$/i, /\.mjs$/i],
            contentTypes: ['application/javascript', 'text/javascript', 'application/x-javascript'],
            icon: '⚡',
            color: '#f59e0b',
            priority: 'High'
        },
        image: {
            patterns: [/\.(jpg|jpeg|png|gif|webp|svg|ico|bmp|avif|tiff)$/i],
            contentTypes: ['image/'],
            icon: '🖼️',
            color: '#10b981',
            priority: 'Low'
        },
        font: {
            patterns: [/\.(woff|woff2|ttf|otf|eot)$/i],
            contentTypes: ['font/', 'application/font'],
            icon: '🔤',
            color: '#6366f1',
            priority: 'Low'
        },
        media: {
            patterns: [/\.(mp4|mp3|avi|wav|ogg|webm|mov|flv|wmv|aac|flac)$/i],
            contentTypes: ['video/', 'audio/'],
            icon: '🎵',
            color: '#ec4899',
            priority: 'Low'
        },
        xhr: {
            patterns: [/\/api\//, /\.json$/i],
            contentTypes: ['application/json', 'application/xml', 'text/plain'],
            icon: '�',
            color: '#06b6d4',
            priority: 'High'
        },
        fetch: {
            patterns: [],
            contentTypes: ['application/json'],
            icon: '📡',
            color: '#0ea5e9',
            priority: 'High'
        },
        websocket: {
            patterns: [/^wss?:/],
            contentTypes: [],
            icon: '⚡',
            color: '#8b5cf6',
            priority: 'High'
        },
        manifest: {
            patterns: [/manifest\.json$/i, /\.webmanifest$/i],
            contentTypes: ['application/manifest+json'],
            icon: '📋',
            color: '#84cc16',
            priority: 'Low'
        },
        other: {
            patterns: [],
            contentTypes: [],
            icon: '📦',
            color: '#64748b',
            priority: 'Low'
        }
    };

    // Network statistics
    static loadStats = {
        totalRequests: 0,
        totalSize: 0,
        totalTransferredSize: 0,
        totalTime: 0,
        domContentLoadedTime: null,
        loadTime: null,
        resourcesByType: {}
    };

    // Enhanced filtering state with Chrome DevTools-like options
    static networkFilters = {
        resourceType: 'all',
        status: 'all',
        method: 'all',
        domain: 'all',
        protocol: 'all',
        search: '',
        showCacheOnly: false,
        showErrors: false,
        sizeRange: 'all', // all, small (<1KB), medium (1KB-100KB), large (>100KB)
        timeRange: 'all',  // all, fast (<100ms), medium (100ms-1s), slow (>1s)
        mimeType: 'all',
        hasResponseHeaders: 'all',
        fromCache: 'all', // all, cached, not-cached
        priority: 'all' // all, high, medium, low
    };

    /**
     * Enhanced network interception for all resource types
     */
    static setupNetworkInterception() {
        // Prevent double-patching
        if (window.__vizDebuggerNetworkPatched) return;
        window.__vizDebuggerNetworkPatched = true;
        console.log('[VizDebugger] Enhanced network interception initialized');

        // Setup comprehensive resource monitoring
        this.setupResourceTimingObserver();
        this.setupPerformanceObserver();
        this.setupDOMLoadEvents();
        this.patchNetworkMethods();
    }

    /**
     * Setup Resource Timing Observer to capture all network resources
     */
    static setupResourceTimingObserver() {
        if (!window.PerformanceObserver) return;

        try {
            const observer = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    if (entry.entryType === 'resource') {
                        this.processResourceEntry(entry);
                    }
                }
            });
            observer.observe({ entryTypes: ['resource'] });
        } catch (error) {
            console.warn('[VizDebugger] PerformanceObserver not supported:', error);
        }
    }

    /**
     * Setup Performance Observer for navigation timing
     */
    static setupPerformanceObserver() {
        if (!window.PerformanceObserver) return;

        try {
            const observer = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    if (entry.entryType === 'navigation') {
                        this.processNavigationEntry(entry);
                    }
                }
            });
            observer.observe({ entryTypes: ['navigation'] });
        } catch (error) {
            console.warn('[VizDebugger] Navigation observer not supported:', error);
        }
    }

    /**
     * Setup DOM load event tracking
     */
    static setupDOMLoadEvents() {
        document.addEventListener('DOMContentLoaded', () => {
            this.loadStats.domContentLoadedTime = performance.now();
            this.updateLoadStats();
        });

        window.addEventListener('load', () => {
            this.loadStats.loadTime = performance.now();
            this.updateLoadStats();
        });
    }

    /**
     * Process resource entry from Performance API with enhanced Chrome DevTools-like data
     */
    static processResourceEntry(entry) {
        const sessionId = this.currentSessionId || this.getActiveSessionId();
        if (!sessionId) return;

        // Enhanced resource type detection with more context
        const resourceType = this.detectResourceType(entry.name, entry.initiatorType, '', 'GET');
        const size = entry.decodedBodySize || entry.encodedBodySize || 0;
        const transferredSize = entry.transferSize || 0;
        const fromCache = entry.transferSize === 0 && entry.decodedBodySize > 0;

        // Determine cache type more accurately
        let cacheStatus = 'network';
        if (fromCache) {
            // If no transfer but has decoded body, it's cached
            cacheStatus = entry.transferSize === 0 ? 'disk-cache' : 'memory-cache';
        }

        // Enhanced priority detection
        const priority = this.determinePriority(resourceType.name);

        const resourceData = {
            id: `resource_${Math.random().toString(36).substr(2, 9)}`,
            name: entry.name,
            url: entry.name,
            method: 'GET', // Most resources are GET
            type: resourceType.name,
            typeIcon: resourceType.icon,
            typeColor: resourceType.color,
            priority: priority,
            initiator: this.formatInitiator(entry.initiatorType, entry.name),
            size: size,
            transferredSize: transferredSize,
            fromCache: fromCache,
            cacheStatus: cacheStatus,
            startTime: entry.startTime,
            responseStart: entry.responseStart,
            responseEnd: entry.responseEnd,
            duration: Math.round(entry.responseEnd - entry.startTime),
            status: 'completed',
            statusCode: 200, // Resource API doesn't provide status codes, assume success
            statusText: 'OK',
            timestamp: Date.now(),
            contentType: this.guessContentTypeFromUrl(entry.name),
            loadTiming: {
                domainLookup: Math.round(entry.domainLookupEnd - entry.domainLookupStart),
                connect: Math.round(entry.connectEnd - entry.connectStart),
                secureConnect: entry.secureConnectionStart > 0 ? Math.round(entry.connectEnd - entry.secureConnectionStart) : 0,
                request: Math.round(entry.responseStart - entry.requestStart),
                response: Math.round(entry.responseEnd - entry.responseStart)
            },
            protocol: entry.nextHopProtocol || 'http/1.1'
        };

        this.addEnhancedNetworkRequest(sessionId, resourceData);
    }

    /**
     * Process navigation entry
     */
    static processNavigationEntry(entry) {
        this.loadStats.domContentLoadedTime = entry.domContentLoadedEventEnd - entry.domContentLoadedEventStart;
        this.loadStats.loadTime = entry.loadEventEnd - entry.loadEventStart;
    }

    /**
     * Patch traditional network methods (XHR/fetch) with enhanced tracking
     */
    static patchNetworkMethods() {
        // Enhanced XMLHttpRequest patching
        const OriginalXHR = window.XMLHttpRequest;
        function PatchedXHR() {
            const xhr = new OriginalXHR();
            let requestId = Math.random().toString(36).substr(2, 9);
            let method = '';
            let url = '';
            let startTime = 0;

            xhr._open = xhr.open;
            xhr.open = function (m, u, ...args) {
                method = m;
                url = u;
                xhr._open(m, u, ...args);
            };

            xhr._send = xhr.send;
            xhr.send = function (data) {
                startTime = Date.now();

                const sessionId = VisualizationDebugger.currentSessionId || VisualizationDebugger.getActiveSessionId();
                if (sessionId) {
                    const resourceType = VisualizationDebugger.detectResourceType(url, 'xmlhttprequest');
                    const requestHeaders = VisualizationDebugger.extractXHRHeaders(xhr);

                    VisualizationDebugger.addEnhancedNetworkRequest(sessionId, {
                        id: requestId,
                        name: url,
                        url: url,
                        method: method,
                        type: resourceType.name,
                        typeIcon: resourceType.icon,
                        typeColor: resourceType.color,
                        initiator: VisualizationDebugger.formatInitiator('xmlhttprequest', url),
                        status: 'pending',
                        requestData: data,
                        requestHeaders: requestHeaders,
                        startTime: startTime,
                        timestamp: Date.now(),
                        cacheStatus: 'network',
                        fromCache: false
                    });
                }

                xhr.addEventListener('loadend', function () {
                    const duration = Date.now() - startTime;
                    const responseHeaders = VisualizationDebugger.parseResponseHeaders(xhr.getAllResponseHeaders());
                    const contentLength = responseHeaders['content-length'] || xhr.response?.length || 0;

                    if (sessionId) {
                        VisualizationDebugger.updateEnhancedNetworkRequest(sessionId, requestId, {
                            status: 'completed',
                            statusCode: xhr.status,
                            statusText: xhr.statusText,
                            duration: duration,
                            responseEnd: Date.now(),
                            size: parseInt(contentLength) || 0,
                            transferredSize: parseInt(contentLength) || 0,
                            response: xhr.response,
                            responseHeaders: responseHeaders,
                            loadTiming: {
                                total: duration
                            }
                        });
                    }
                });

                xhr.addEventListener('error', function () {
                    if (sessionId) {
                        VisualizationDebugger.updateEnhancedNetworkRequest(sessionId, requestId, {
                            status: 'failed',
                            statusCode: 0,
                            statusText: 'Network Error',
                            duration: Date.now() - startTime,
                            error: 'Network request failed'
                        });
                    }
                });

                xhr._send(data);
            };
            return xhr;
        }
        window.XMLHttpRequest = PatchedXHR;

        // Enhanced fetch patching
        const originalFetch = window.fetch;
        window.fetch = function (input, init = {}) {
            let method = (init && init.method) || 'GET';
            let url = (typeof input === 'string') ? input : (input && input.url) || '';
            let requestId = Math.random().toString(36).substr(2, 9);
            let startTime = Date.now();

            // Extract meaningful information for proxy requests
            let displayUrl = url;
            let displayMethod = method;

            if (url.includes('/api/proxy') && init.body) {
                try {
                    const proxyData = JSON.parse(init.body);
                    if (proxyData.url) {
                        displayUrl = proxyData.url;
                        displayMethod = proxyData.method || method;
                    }
                } catch (e) {
                    // If parsing fails, use original URL
                }
            }

            const sessionId = VisualizationDebugger.currentSessionId || VisualizationDebugger.getActiveSessionId();
            if (sessionId) {
                const resourceType = VisualizationDebugger.detectResourceType(displayUrl, 'fetch');
                const requestHeaders = init.headers || {};

                VisualizationDebugger.addEnhancedNetworkRequest(sessionId, {
                    id: requestId,
                    name: displayUrl,
                    url: displayUrl,
                    method: displayMethod,
                    type: resourceType.name,
                    typeIcon: resourceType.icon,
                    typeColor: resourceType.color,
                    initiator: VisualizationDebugger.formatInitiator('fetch', displayUrl),
                    status: 'pending',
                    requestData: init && init.body,
                    requestHeaders: requestHeaders,
                    startTime: startTime,
                    timestamp: Date.now(),
                    originalUrl: url,
                    cacheStatus: 'network',
                    fromCache: false
                });
            }

            return originalFetch(input, init).then(response => {
                const duration = Date.now() - startTime;
                const responseHeaders = VisualizationDebugger.headersToObject(response.headers);
                const contentLength = response.headers.get('content-length') || 0;

                if (sessionId) {
                    VisualizationDebugger.updateEnhancedNetworkRequest(sessionId, requestId, {
                        status: 'completed',
                        statusCode: response.status,
                        statusText: response.statusText,
                        duration: duration,
                        responseEnd: Date.now(),
                        size: parseInt(contentLength) || 0,
                        transferredSize: parseInt(contentLength) || 0,
                        responseHeaders: responseHeaders,
                        loadTiming: {
                            total: duration
                        }
                    });
                }
                return response;
            }).catch(error => {
                const duration = Date.now() - startTime;
                if (sessionId) {
                    VisualizationDebugger.updateEnhancedNetworkRequest(sessionId, requestId, {
                        status: 'failed',
                        statusCode: 0,
                        statusText: error.message,
                        duration: duration,
                        error: error.message
                    });
                }
                throw error;
            });
        };
    }

    /**
     * Enhanced resource type detection with Chrome DevTools-like categorization
     */
    static detectResourceType(url, initiator = '', contentType = '', method = 'GET') {
        const urlLower = url.toLowerCase();

        // First check by content type (most reliable)
        if (contentType) {
            const contentTypeLower = contentType.toLowerCase();
            for (const [typeName, typeInfo] of Object.entries(this.RESOURCE_TYPES)) {
                if (typeName === 'other') continue;

                for (const ct of typeInfo.contentTypes) {
                    if (contentTypeLower.includes(ct.toLowerCase())) {
                        return { name: typeName, ...typeInfo };
                    }
                }
            }
        }

        // Check by URL patterns (file extensions, path patterns)
        for (const [typeName, typeInfo] of Object.entries(this.RESOURCE_TYPES)) {
            if (typeName === 'other') continue;

            for (const pattern of typeInfo.patterns) {
                if (pattern.test(urlLower)) {
                    return { name: typeName, ...typeInfo };
                }
            }
        }

        // Enhanced initiator-based detection
        switch (initiator.toLowerCase()) {
            case 'xmlhttprequest':
                // Distinguish between API calls and regular XHR
                if (urlLower.includes('/api/') || urlLower.includes('.json') ||
                    urlLower.includes('/graphql') || method !== 'GET') {
                    return { name: 'xhr', ...this.RESOURCE_TYPES.xhr };
                }
                return { name: 'xhr', ...this.RESOURCE_TYPES.xhr };

            case 'fetch':
                return { name: 'fetch', ...this.RESOURCE_TYPES.fetch };

            case 'link':
                // Could be stylesheet or preload
                if (urlLower.includes('.css')) {
                    return { name: 'stylesheet', ...this.RESOURCE_TYPES.stylesheet };
                }
                return { name: 'other', ...this.RESOURCE_TYPES.other };

            case 'script':
                return { name: 'script', ...this.RESOURCE_TYPES.script };

            case 'img':
                return { name: 'image', ...this.RESOURCE_TYPES.image };

            case 'navigation':
                return { name: 'document', ...this.RESOURCE_TYPES.document };

            case 'beacon':
                return { name: 'xhr', ...this.RESOURCE_TYPES.xhr };

            default:
                // Check for WebSocket
                if (urlLower.startsWith('ws://') || urlLower.startsWith('wss://')) {
                    return { name: 'websocket', ...this.RESOURCE_TYPES.websocket };
                }

                // Default to other
                return { name: 'other', ...this.RESOURCE_TYPES.other };
        }
    }

    /**
     * Format initiator information
     */
    static formatInitiator(type, url) {
        const fileName = url.split('/').pop() || url;
        switch (type) {
            case 'xmlhttprequest':
                return `XHR • ${fileName}`;
            case 'fetch':
                return `Fetch • ${fileName}`;
            case 'script':
                return `Script • ${fileName}`;
            case 'link':
                return `Link • ${fileName}`;
            case 'img':
                return `Image • ${fileName}`;
            default:
                return `${type} • ${fileName}`;
        }
    }

    /**
     * Helper methods for header processing
     */
    static extractXHRHeaders(xhr) {
        // XHR doesn't expose request headers easily
        return {};
    }

    static parseResponseHeaders(headersString) {
        const headers = {};
        if (headersString) {
            headersString.split('\r\n').forEach(line => {
                const [key, ...valueParts] = line.split(': ');
                if (key && valueParts.length) {
                    headers[key.toLowerCase()] = valueParts.join(': ');
                }
            });
        }
        return headers;
    }

    static headersToObject(headers) {
        const obj = {};
        for (const [key, value] of headers.entries()) {
            obj[key] = value;
        }
        return obj;
    }

    /**
     * Get active session ID or create a default one if none exists
     */
    static getActiveSessionId() {
        if (this.currentSessionId) return this.currentSessionId;

        if (this.debugSessions.size > 0) {
            return Array.from(this.debugSessions.keys())[0];
        }

        // If no sessions exist, create a default one
        const defaultSessionId = `default-session-${Date.now()}`;

        // Create a minimal session object
        this.debugSessions.set(defaultSessionId, {
            id: defaultSessionId,
            startTime: Date.now(),
            logs: [],
            networkRequests: []
        });

        // Set as current session
        this.currentSessionId = defaultSessionId;

        return defaultSessionId;
    }
    static debugSessions = new Map();
    static isEnabled = false;
    static debugPanel = null;
    static currentSessionId = null;
    static isInitialized = false;

    // Network interception
    static _networkInterceptionActive = false;

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
            VisualizationDebugger.setupNetworkInterception();

            // Create a default debug session if none exists
            if (this.debugSessions.size === 0) {
                const defaultSessionId = this.getActiveSessionId();
                this.log('🔍 Debug console initialized', 'info', null, defaultSessionId);
            }

            this.isInitialized = true;
        }
    }
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

        // Use internal logging for system messages
        this.internalLog('🔍 Browser console interception activated', 'success');
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
            const firstMessage = args[0];
            if (firstMessage.includes('[VisualizationDebugger]') ||
                firstMessage.includes('🎯 Setting up console input') ||
                firstMessage.includes('📝 Executing command:')) {
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

        // Add tabbed UI for Console, Network, Performance, Elements
        panel.innerHTML = `
            <div class="debug-header">
                <div class="debug-tabs">
                    <button class="debug-tab debug-tab-active" data-tab="console">Console</button>
                    <button class="debug-tab" data-tab="network">Network</button>
                    <button class="debug-tab" data-tab="performance">Performance</button>
                    <button class="debug-tab" data-tab="elements">Elements</button>
                </div>
            </div>
            <div class="debug-panels">
                <div class="debug-panel active" id="console-panel">
                    <div id="console-output" class="console-logs-container"></div>
                </div>
                <div class="debug-panel" id="network-panel">
                    <div id="network-requests" class="network-requests"></div>
                </div>
                <div class="debug-panel" id="performance-panel">
                    <div id="performance-metrics" class="performance-metrics"></div>
                </div>
                <div class="debug-panel" id="elements-panel">
                    <div id="elements-tree" class="elements-tree"></div>
                </div>
            </div>
        `;

        // Tab switching
        panel.querySelectorAll('.debug-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabName = tab.getAttribute('data-tab');
                this.switchTab(tabName);
                if (tabName === 'network') this.renderEnhancedNetworkPanel();
                if (tabName === 'performance') this.renderPerformancePanel();
                if (tabName === 'elements') this.renderElementsPanel();
            });
        });
        document.body.appendChild(panel);
        this.debugPanel = panel;
        // Render initial network panel if needed
        this.renderEnhancedNetworkPanel();
    }
    /**
     * Render the Performance panel with live metrics
     */
    static renderPerformancePanel() {
        const panel = document.getElementById('performance-metrics');
        if (!panel) return;

        const session = this.getCurrentSession();

        // Gather browser performance metrics
        let navTiming = window.performance.getEntriesByType('navigation')[0] || {};
        let resourceCount = window.performance.getEntriesByType('resource').length;
        let memory = window.performance.memory || {};
        let domNodes = document.getElementsByTagName('*').length;
        let renderTime = navTiming.domComplete - navTiming.startTime || 0;
        let usedJSHeap = memory.usedJSHeapSize ? (memory.usedJSHeapSize / 1024 / 1024).toFixed(2) + ' MB' : 'N/A';

        // Session-specific metrics
        let sessionDuration = session && session.startTime ?
            ((Date.now() - session.startTime) / 1000).toFixed(1) + 's' : 'N/A';
        let networkRequestCount = session && session.networkRequests ? session.networkRequests.length : 0;
        let avgRequestTime = 'N/A';
        let totalRequestTime = 0;

        if (session && session.networkRequests && session.networkRequests.length > 0) {
            const completedRequests = session.networkRequests.filter(req => req.duration);
            if (completedRequests.length > 0) {
                totalRequestTime = completedRequests.reduce((sum, req) => sum + req.duration, 0);
                avgRequestTime = (totalRequestTime / completedRequests.length).toFixed(2) + 'ms';
            }
        }

        let logCount = session && session.logs ? session.logs.length : 0;

        panel.innerHTML = `
            <div class="performance-metrics" style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 16px;">
                <div style="grid-column: 1 / -1; color: #ff6c37; font-weight: bold; margin-bottom: 8px;">Session Performance</div>
                <div class="metric-item" style="background: rgba(255, 255, 255, 0.05); padding: 10px; border-radius: 6px;">
                    <div style="color: #64748b; font-size: 12px;">Session Duration</div>
                    <div style="color: #f1f5f9; font-size: 16px; font-weight: bold;">${sessionDuration}</div>
                </div>
                <div class="metric-item" style="background: rgba(255, 255, 255, 0.05); padding: 10px; border-radius: 6px;">
                    <div style="color: #64748b; font-size: 12px;">Network Requests</div>
                    <div style="color: #f1f5f9; font-size: 16px; font-weight: bold;">${networkRequestCount}</div>
                </div>
                <div class="metric-item" style="background: rgba(255, 255, 255, 0.05); padding: 10px; border-radius: 6px;">
                    <div style="color: #64748b; font-size: 12px;">Avg Request Time</div>
                    <div style="color: #f1f5f9; font-size: 16px; font-weight: bold;">${avgRequestTime}</div>
                </div>
                <div class="metric-item" style="background: rgba(255, 255, 255, 0.05); padding: 10px; border-radius: 6px;">
                    <div style="color: #64748b; font-size: 12px;">Total Log Entries</div>
                    <div style="color: #f1f5f9; font-size: 16px; font-weight: bold;">${logCount}</div>
                </div>
                
                <div style="grid-column: 1 / -1; color: #ff6c37; font-weight: bold; margin: 16px 0 8px 0;">Browser Performance</div>
                <div class="metric-item" style="background: rgba(255, 255, 255, 0.05); padding: 10px; border-radius: 6px;">
                    <div style="color: #64748b; font-size: 12px;">Page Render Time</div>
                    <div style="color: #f1f5f9; font-size: 16px; font-weight: bold;">${renderTime.toFixed(2)}ms</div>
                </div>
                <div class="metric-item" style="background: rgba(255, 255, 255, 0.05); padding: 10px; border-radius: 6px;">
                    <div style="color: #64748b; font-size: 12px;">DOM Nodes</div>
                    <div style="color: #f1f5f9; font-size: 16px; font-weight: bold;">${domNodes}</div>
                </div>
                <div class="metric-item" style="background: rgba(255, 255, 255, 0.05); padding: 10px; border-radius: 6px;">
                    <div style="color: #64748b; font-size: 12px;">JS Heap Used</div>
                    <div style="color: #f1f5f9; font-size: 16px; font-weight: bold;">${usedJSHeap}</div>
                </div>
                <div class="metric-item" style="background: rgba(255, 255, 255, 0.05); padding: 10px; border-radius: 6px;">
                    <div style="color: #64748b; font-size: 12px;">Resource Count</div>
                    <div style="color: #f1f5f9; font-size: 16px; font-weight: bold;">${resourceCount}</div>
                </div>
            </div>
        `;
    }

    /**
     * Render the Elements panel with request/response structure
     */
    static renderElementsPanel() {
        const panel = document.getElementById('elements-tree');
        if (!panel) return;

        const session = this.getCurrentSession();

        if (!session || !session.networkRequests || session.networkRequests.length === 0) {
            panel.innerHTML = `
                <div style="padding:24px;color:#8b92a5;text-align:center;">
                    <h4 style="color:#ff6c37;">🏗️ Request Structure Inspector</h4>
                    <p>No API requests to inspect yet. Make a request to see its structure here.</p>
                </div>
            `;
            return;
        }

        // Show the most recent request's structure
        const latestRequest = session.networkRequests[session.networkRequests.length - 1];

        let requestStructure = '';
        let responseStructure = '';

        // Build request structure
        if (latestRequest.requestData) {
            try {
                const reqData = typeof latestRequest.requestData === 'string' ?
                    JSON.parse(latestRequest.requestData) : latestRequest.requestData;
                requestStructure = this.buildObjectTree(reqData, 'Request Body');
            } catch (e) {
                requestStructure = `<div style="color:#8b92a5;">Request body: ${latestRequest.requestData}</div>`;
            }
        }

        // Build response structure
        if (latestRequest.response) {
            try {
                const respData = typeof latestRequest.response === 'string' ?
                    JSON.parse(latestRequest.response) : latestRequest.response;
                responseStructure = this.buildObjectTree(respData, 'Response Body');
            } catch (e) {
                responseStructure = `<div style="color:#8b92a5;">Response: ${latestRequest.response}</div>`;
            }
        }

        panel.innerHTML = `
            <div style="padding:12px;">
                <div style="background:rgba(255,108,55,0.1);padding:12px;border-radius:6px;margin-bottom:16px;">
                    <h4 style="color:#ff6c37;margin:0 0 8px 0;font-size:14px;">🔍 Latest Request: ${latestRequest.method} ${latestRequest.targetUrl || latestRequest.url}</h4>
                    <div style="color:#8b92a5;font-size:12px;">Status: <span style="color:#10b981;">${latestRequest.statusCode} ${latestRequest.statusText}</span> | Duration: ${latestRequest.duration}ms</div>
                </div>
                
                ${requestStructure ? `
                    <div style="margin-bottom:16px;">
                        <h5 style="color:#64748b;margin:0 0 8px 0;">📤 Request Structure</h5>
                        ${requestStructure}
                    </div>
                ` : ''}
                
                ${responseStructure ? `
                    <div>
                        <h5 style="color:#64748b;margin:0 0 8px 0;">📥 Response Structure</h5>
                        ${responseStructure}
                    </div>
                ` : '<div style="color:#8b92a5;">No response data available</div>'}
            </div>
        `;
    }

    /**
     * Build a tree representation of an object
     */
    static buildObjectTree(obj, rootName = 'Object', level = 0) {
        if (obj === null || obj === undefined) {
            return `<div style="margin-left:${level * 16}px;color:#8b92a5;">null</div>`;
        }

        if (typeof obj !== 'object') {
            const typeColor = typeof obj === 'string' ? '#10b981' :
                typeof obj === 'number' ? '#3b82f6' :
                    typeof obj === 'boolean' ? '#f59e0b' : '#8b92a5';
            return `<div style="margin-left:${level * 16}px;color:${typeColor};">${JSON.stringify(obj)}</div>`;
        }

        let html = `<div style="margin-left:${level * 16}px;">
            <span style="color:#ff6c37;cursor:pointer;" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? 'block' : 'none'">
                ${level === 0 ? '📁' : '📂'} ${rootName} ${Array.isArray(obj) ? `[${obj.length}]` : `{${Object.keys(obj).length}}`}
            </span>
            <div style="margin-left:16px;">`;

        if (Array.isArray(obj)) {
            obj.slice(0, 5).forEach((item, index) => {
                html += this.buildObjectTree(item, `[${index}]`, level + 1);
            });
            if (obj.length > 5) {
                html += `<div style="margin-left:${(level + 1) * 16}px;color:#8b92a5;">... and ${obj.length - 5} more items</div>`;
            }
        } else {
            const keys = Object.keys(obj).slice(0, 10);
            keys.forEach(key => {
                html += this.buildObjectTree(obj[key], key, level + 1);
            });
            if (Object.keys(obj).length > 10) {
                html += `<div style="margin-left:${(level + 1) * 16}px;color:#8b92a5;">... and ${Object.keys(obj).length - 10} more properties</div>`;
            }
        }

        html += '</div></div>';
        return html;
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
            internalLogs: [], // Separate array for internal debug messages
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

        // Ensure network interception is active for this session
        if (!this._networkInterceptionActive) {
            this.setupNetworkInterception();
            this._networkInterceptionActive = true;
        }

        // Capture any existing resources that loaded before debugging started
        this.captureExistingResources(visualizationId);

        // Add some sample network requests for testing if no real requests exist
        setTimeout(() => {
            if (session.networkRequests.length === 0) {
                this.addSampleNetworkRequests(visualizationId);
            }
        }, 1000);

        // Log session start with internal logging (not shown in console)
        this.internalLog(`🔍 Debug session started | Session ID: ${visualizationId}`, 'info');
        this.internalLog(`⏰ Ready at: ${new Date().toLocaleTimeString()}`, 'info');
        this.internalLog(`🌐 Network interception active`, 'info');

        // Don't clear the console - keep the welcome message visible
        // The welcome message serves as a useful indicator that the debug console is ready

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
            stack: new Error().stack,
            source: 'console' // Mark as actual console output
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
     * Internal debug logging that doesn't show in console tab
     */
    static internalLog(message, type = 'debug', data = null, sessionId = null) {
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
            stack: new Error().stack,
            source: 'internal' // Mark as internal debug message
        };

        const targetSessionId = sessionId || this.currentSessionId;
        const session = this.debugSessions.get(targetSessionId);

        if (session) {
            // Store in separate internal logs array
            if (!session.internalLogs) session.internalLogs = [];
            session.internalLogs.push(logEntry);
        }

        // Only log to browser console for debugging purposes in development
        if (process.env.NODE_ENV === 'development' && (type === 'error' || type === 'warn')) {
            console.log(`[VizDebug:Internal:${type}] ${message}`, data);
        }
    }

    /**
     * Display log entry in debug panel
     */
    static displayLogInPanel(logEntry) {
        // Don't display internal debug logs in the console panel
        if (logEntry.source === 'internal') {
            return;
        }

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
            case 'error': return '❌';
            case 'warn': return '⚠️';
            case 'success': return '✅';
            case 'info': return 'ℹ️';
            case 'debug': return '🔍';
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
     * Scroll console to bottom
     */
    static scrollToBottom() {
        const consoleContainer = document.querySelector('.debug-console-container');
        if (consoleContainer) {
            consoleContainer.scrollTop = consoleContainer.scrollHeight;
        }

        // Also try the console logs container as fallback
        const consoleOutput = document.getElementById('console-output');
        if (consoleOutput) {
            consoleOutput.scrollTop = consoleOutput.scrollHeight;
        }
    }

    /**
     * Add log entry (alias for log method)
     */
    static addLog(sessionId, type, message, data) {
        this.log(message, type, data, sessionId);
    }

    /**
     * Capture existing resources that were loaded before debugging started
     */
    static captureExistingResources(sessionId) {
        try {
            // Get all resource entries from performance
            const resources = window.performance.getEntriesByType('resource');
            const navigation = window.performance.getEntriesByType('navigation')[0];

            // Process navigation entry (main document)
            if (navigation) {
                const navResourceData = {
                    id: `nav_${Math.random().toString(36).substr(2, 9)}`,
                    name: navigation.name,
                    url: navigation.name,
                    method: 'GET',
                    type: 'document',
                    typeIcon: '📄',
                    typeColor: '#3b82f6',
                    priority: 'High',
                    initiator: 'navigation',
                    size: navigation.decodedBodySize || 0,
                    transferredSize: navigation.transferSize || 0,
                    fromCache: navigation.transferSize === 0 && navigation.decodedBodySize > 0,
                    cacheStatus: navigation.transferSize === 0 && navigation.decodedBodySize > 0 ? 'disk-cache' : 'network',
                    startTime: navigation.startTime,
                    responseStart: navigation.responseStart,
                    responseEnd: navigation.responseEnd,
                    duration: Math.round(navigation.responseEnd - navigation.startTime),
                    status: 'completed',
                    statusCode: 200,
                    statusText: 'OK',
                    timestamp: Date.now() - (performance.now() - navigation.startTime),
                    contentType: 'text/html',
                    loadTiming: {
                        domainLookup: Math.round(navigation.domainLookupEnd - navigation.domainLookupStart),
                        connect: Math.round(navigation.connectEnd - navigation.connectStart),
                        secureConnect: navigation.secureConnectionStart > 0 ? Math.round(navigation.connectEnd - navigation.secureConnectionStart) : 0,
                        request: Math.round(navigation.responseStart - navigation.requestStart),
                        response: Math.round(navigation.responseEnd - navigation.responseStart)
                    },
                    protocol: navigation.nextHopProtocol || 'http/1.1'
                };
                this.addEnhancedNetworkRequest(sessionId, navResourceData);
            }

            // Process existing resource entries
            resources.forEach(entry => {
                this.processResourceEntry(entry);
            });

            this.internalLog(`📊 Captured ${resources.length + (navigation ? 1 : 0)} existing resources from browser cache`, 'info');
        } catch (error) {
            console.warn('[VizDebugger] Error capturing existing resources:', error);
        }
    }

    /**
     * Add sample network requests for testing filters
     */
    static addSampleNetworkRequests(sessionId) {
        const sampleRequests = [
            {
                id: 'sample_doc_1',
                name: 'https://api.pigeon.dev/',
                url: 'https://api.pigeon.dev/',
                method: 'GET',
                type: 'document',
                typeIcon: '📄',
                typeColor: '#3b82f6',
                priority: 'High',
                initiator: 'navigation',
                size: 15420,
                transferredSize: 4532,
                fromCache: false,
                cacheStatus: 'network',
                duration: 234,
                status: 'completed',
                statusCode: 200,
                statusText: 'OK',
                contentType: 'text/html'
            },
            {
                id: 'sample_css_1',
                name: 'https://api.pigeon.dev/styles/main.css',
                url: 'https://api.pigeon.dev/styles/main.css',
                method: 'GET',
                type: 'stylesheet',
                typeIcon: '🎨',
                typeColor: '#8b5cf6',
                priority: 'High',
                initiator: 'link',
                size: 8945,
                transferredSize: 0,
                fromCache: true,
                cacheStatus: 'disk-cache',
                duration: 12,
                status: 'completed',
                statusCode: 200,
                statusText: 'OK',
                contentType: 'text/css'
            },
            {
                id: 'sample_js_1',
                name: 'https://api.pigeon.dev/js/app.js',
                url: 'https://api.pigeon.dev/js/app.js',
                method: 'GET',
                type: 'script',
                typeIcon: '⚡',
                typeColor: '#f59e0b',
                priority: 'High',
                initiator: 'script',
                size: 25600,
                transferredSize: 7890,
                fromCache: false,
                cacheStatus: 'network',
                duration: 156,
                status: 'completed',
                statusCode: 200,
                statusText: 'OK',
                contentType: 'application/javascript'
            },
            {
                id: 'sample_img_1',
                name: 'https://api.pigeon.dev/images/logo.png',
                url: 'https://api.pigeon.dev/images/logo.png',
                method: 'GET',
                type: 'image',
                typeIcon: '🖼️',
                typeColor: '#10b981',
                priority: 'Low',
                initiator: 'img',
                size: 12340,
                transferredSize: 12340,
                fromCache: false,
                cacheStatus: 'network',
                duration: 89,
                status: 'completed',
                statusCode: 200,
                statusText: 'OK',
                contentType: 'image/png'
            },
            {
                id: 'sample_xhr_1',
                name: 'https://api.pigeon.dev/api/collections',
                url: 'https://api.pigeon.dev/api/collections',
                method: 'GET',
                type: 'xhr',
                typeIcon: '📊',
                typeColor: '#06b6d4',
                priority: 'High',
                initiator: 'xmlhttprequest',
                size: 2340,
                transferredSize: 2340,
                fromCache: false,
                cacheStatus: 'network',
                duration: 287,
                status: 'completed',
                statusCode: 200,
                statusText: 'OK',
                contentType: 'application/json'
            },
            {
                id: 'sample_font_1',
                name: 'https://api.pigeon.dev/fonts/roboto.woff2',
                url: 'https://api.pigeon.dev/fonts/roboto.woff2',
                method: 'GET',
                type: 'font',
                typeIcon: '🔤',
                typeColor: '#6366f1',
                priority: 'Low',
                initiator: 'css',
                size: 45600,
                transferredSize: 0,
                fromCache: true,
                cacheStatus: 'memory-cache',
                duration: 5,
                status: 'completed',
                statusCode: 200,
                statusText: 'OK',
                contentType: 'font/woff2'
            }
        ];

        sampleRequests.forEach(request => {
            this.addEnhancedNetworkRequest(sessionId, {
                ...request,
                timestamp: Date.now() - Math.random() * 5000,
                loadTiming: {
                    domainLookup: Math.random() * 10,
                    connect: Math.random() * 20,
                    request: Math.random() * 50,
                    response: Math.random() * 100
                }
            });
        });

        this.internalLog(`🧪 Added ${sampleRequests.length} sample network requests for testing`, 'debug');
    }

    /**
     * Add enhanced network request to session with comprehensive metadata
     */
    static addEnhancedNetworkRequest(sessionId, requestData) {
        const session = this.debugSessions.get(sessionId);
        if (session) {
            const enhancedRequest = {
                ...requestData,
                timestamp: Date.now(),
                priority: this.determinePriority(requestData.type),
                waterfall: this.calculateWaterfall(requestData)
            };

            session.networkRequests.push(enhancedRequest);

            // Update load statistics
            this.updateLoadStatsForRequest(enhancedRequest);

            // Use internal logging for network activity (not shown in console)
            this.internalLog(`🌐 Network request initiated: ${requestData.method || 'GET'} ${requestData.url}`, 'info', requestData, sessionId);

            // Auto-refresh network panel if it's currently visible
            this.refreshNetworkPanelIfVisible();
        }
    }

    /**
     * Update enhanced network request with response data
     */
    static updateEnhancedNetworkRequest(sessionId, requestId, updateData) {
        const session = this.debugSessions.get(sessionId);
        if (session) {
            const request = session.networkRequests.find(req => req.id === requestId);
            if (request) {
                Object.assign(request, updateData);

                // Update waterfall data
                if (updateData.responseEnd) {
                    request.waterfall = this.calculateWaterfall(request);
                }

                // Update load statistics
                this.updateLoadStatsForRequest(request);

                // Use internal logging for network activity (not shown in console)
                if (updateData.status === 'completed') {
                    this.internalLog(`✅ ${request.type} completed: ${updateData.statusCode} ${updateData.statusText} (${updateData.duration}ms)`, 'success', updateData, sessionId);
                } else if (updateData.status === 'failed') {
                    this.internalLog(`❌ ${request.type} failed: ${updateData.error}`, 'error', updateData, sessionId);
                }

                this.refreshNetworkPanelIfVisible();
            }
        }
    }

    /**
     * Calculate waterfall timing data
     */
    static calculateWaterfall(request) {
        if (!request.loadTiming) return null;

        const total = request.duration || 0;
        return {
            total: total,
            breakdown: request.loadTiming,
            percentage: total > 0 ? {
                domainLookup: ((request.loadTiming.domainLookup || 0) / total) * 100,
                connect: ((request.loadTiming.connect || 0) / total) * 100,
                request: ((request.loadTiming.request || 0) / total) * 100,
                response: ((request.loadTiming.response || 0) / total) * 100
            } : null
        };
    }

    /**
     * Determine request priority
     */
    static determinePriority(type) {
        const priorityMap = {
            document: 'VeryHigh',
            stylesheet: 'High',
            script: 'High',
            font: 'High',
            xhr: 'High',
            image: 'Medium',
            media: 'Low',
            other: 'Low'
        };
        return priorityMap[type] || 'Low';
    }

    /**
     * Update load statistics for a request
     */
    static updateLoadStatsForRequest(request) {
        if (request.status === 'completed') {
            this.loadStats.totalRequests++;
            this.loadStats.totalSize += request.size || 0;
            this.loadStats.totalTransferredSize += request.transferredSize || 0;
            this.loadStats.totalTime += request.duration || 0;

            // Update by type
            if (!this.loadStats.resourcesByType[request.type]) {
                this.loadStats.resourcesByType[request.type] = {
                    count: 0,
                    size: 0,
                    transferredSize: 0
                };
            }
            this.loadStats.resourcesByType[request.type].count++;
            this.loadStats.resourcesByType[request.type].size += request.size || 0;
            this.loadStats.resourcesByType[request.type].transferredSize += request.transferredSize || 0;
        }
    }

    /**
     * Update overall load statistics
     */
    static updateLoadStats() {
        // Recalculate from all sessions
        this.loadStats = {
            totalRequests: 0,
            totalSize: 0,
            totalTransferredSize: 0,
            totalTime: 0,
            domContentLoadedTime: this.loadStats.domContentLoadedTime,
            loadTime: this.loadStats.loadTime,
            resourcesByType: {}
        };

        for (const session of this.debugSessions.values()) {
            if (session.networkRequests) {
                session.networkRequests.forEach(request => {
                    if (request.status === 'completed') {
                        this.updateLoadStatsForRequest(request);
                    }
                });
            }
        }
    }

    /**
     * Refresh network panel if visible
     */
    static refreshNetworkPanelIfVisible() {
        const networkPanel = document.getElementById('network-requests');
        if (networkPanel && networkPanel.offsetParent !== null) {
            this.renderEnhancedNetworkPanel();
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

        // Render panels as needed
        if (tabName === 'network') this.renderEnhancedNetworkPanel();
        // (Performance and Elements panels can be added similarly)
    }

    /**
     * Render the Enhanced Network panel with comprehensive resource capture
     */
    static renderEnhancedNetworkPanel() {
        const panel = document.getElementById('network-requests');
        if (!panel) return;

        const session = this.getCurrentSession();
        if (!session) {
            panel.innerHTML = '<div style="padding:24px;color:#8b92a5;">No debug session active.</div>';
            return;
        }

        if (!session.networkRequests || session.networkRequests.length === 0) {
            panel.innerHTML = `
                <div style="padding:24px;color:#8b92a5;text-align:center;">
                    <h4 style="color:#ff6c37;">📡 Network Activity Monitor</h4>
                    <p>No network requests captured yet. Make API calls or visit websites to see comprehensive network activity.</p>
                </div>
            `;
            return;
        }

        // Apply current filters
        const filteredRequests = this.applyNetworkFilters(session.networkRequests);

        // Generate network panel HTML
        let html = this.generateNetworkPanelHTML(filteredRequests);
        panel.innerHTML = html;

        // Attach event handlers
        this.attachNetworkPanelEventHandlers(panel, session);
    }

    /**
     * Generate the complete network panel HTML with enhanced Chrome DevTools-like features
     */
    static generateNetworkPanelHTML(requests) {
        const loadStats = this.calculateSessionLoadStats(requests);
        const uniqueDomains = [...new Set(requests.map(req => this.getDomainFromUrl(req.url)))].filter(Boolean);
        const uniqueMethods = [...new Set(requests.map(req => req.method))].filter(Boolean);

        // Helper function to generate option with proper selection
        const generateOption = (value, text, currentValue) => {
            const selected = value === currentValue ? ' selected' : '';
            return `<option value="${value}"${selected}>${text}</option>`;
        };

        return `
            <!-- Enhanced Filters and Controls -->
            <div class="network-controls" style="margin-bottom: 16px; padding: 12px; background: #1a1d23; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">
                <!-- Primary Filters Row -->
                <div style="display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin-bottom: 12px;">
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <label style="color: #8b949e; font-size: 12px; font-weight: 500;">Type:</label>
                        <select id="network-type-filter" style="background: #21262d; color: #f0f6fc; border: 1px solid #30363d; border-radius: 4px; padding: 4px 8px; font-size: 12px; min-width: 120px;">
                            ${generateOption('all', 'All Resources', this.networkFilters.resourceType)}
                            ${generateOption('xhr', 'XHR/API', this.networkFilters.resourceType)}
                            ${generateOption('fetch', 'Fetch', this.networkFilters.resourceType)}
                            ${generateOption('document', 'Documents', this.networkFilters.resourceType)}
                            ${generateOption('stylesheet', 'Stylesheets', this.networkFilters.resourceType)}
                            ${generateOption('script', 'Scripts', this.networkFilters.resourceType)}
                            ${generateOption('image', 'Images', this.networkFilters.resourceType)}
                            ${generateOption('font', 'Fonts', this.networkFilters.resourceType)}
                            ${generateOption('media', 'Media', this.networkFilters.resourceType)}
                            ${generateOption('websocket', 'WebSocket', this.networkFilters.resourceType)}
                            ${generateOption('manifest', 'Manifest', this.networkFilters.resourceType)}
                            ${generateOption('other', 'Other', this.networkFilters.resourceType)}
                        </select>
                    </div>
                    
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <label style="color: #8b949e; font-size: 12px; font-weight: 500;">Status:</label>
                        <select id="network-status-filter" style="background: #21262d; color: #f0f6fc; border: 1px solid #30363d; border-radius: 4px; padding: 4px 8px; font-size: 12px;">
                            ${generateOption('all', 'All Status', this.networkFilters.status)}
                            ${generateOption('completed', 'Completed', this.networkFilters.status)}
                            ${generateOption('failed', 'Failed', this.networkFilters.status)}
                            ${generateOption('pending', 'Pending', this.networkFilters.status)}
                        </select>
                    </div>
                    
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <label style="color: #8b949e; font-size: 12px; font-weight: 500;">Method:</label>
                        <select id="network-method-filter" style="background: #21262d; color: #f0f6fc; border: 1px solid #30363d; border-radius: 4px; padding: 4px 8px; font-size: 12px;">
                            ${generateOption('all', 'All Methods', this.networkFilters.method)}
                            ${uniqueMethods.map(method => generateOption(method, method, this.networkFilters.method)).join('')}
                        </select>
                    </div>
                    
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <label style="color: #8b949e; font-size: 12px; font-weight: 500;">Cache:</label>
                        <select id="network-cache-filter" style="background: #21262d; color: #f0f6fc; border: 1px solid #30363d; border-radius: 4px; padding: 4px 8px; font-size: 12px;">
                            ${generateOption('all', 'All', this.networkFilters.fromCache)}
                            ${generateOption('cached', 'Cached', this.networkFilters.fromCache)}
                            ${generateOption('not-cached', 'Not Cached', this.networkFilters.fromCache)}
                        </select>
                    </div>
                </div>
                
                <!-- Secondary Filters Row -->
                <div style="display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin-bottom: 12px;">
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <label style="color: #8b949e; font-size: 12px; font-weight: 500;">Domain:</label>
                        <select id="network-domain-filter" style="background: #21262d; color: #f0f6fc; border: 1px solid #30363d; border-radius: 4px; padding: 4px 8px; font-size: 12px; max-width: 150px;">
                            ${generateOption('all', 'All Domains', this.networkFilters.domain)}
                            ${uniqueDomains.map(domain => generateOption(domain, this.truncateText(domain, 20), this.networkFilters.domain)).join('')}
                        </select>
                    </div>
                    
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <label style="color: #8b949e; font-size: 12px; font-weight: 500;">Size:</label>
                        <select id="network-size-filter" style="background: #21262d; color: #f0f6fc; border: 1px solid #30363d; border-radius: 4px; padding: 4px 8px; font-size: 12px;">
                            ${generateOption('all', 'All Sizes', this.networkFilters.sizeRange)}
                            ${generateOption('small', 'Small (&lt; 1KB)', this.networkFilters.sizeRange)}
                            ${generateOption('medium', 'Medium (1KB - 100KB)', this.networkFilters.sizeRange)}
                            ${generateOption('large', 'Large (&gt; 100KB)', this.networkFilters.sizeRange)}
                        </select>
                    </div>
                    
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <label style="color: #8b949e; font-size: 12px; font-weight: 500;">Time:</label>
                        <select id="network-time-filter" style="background: #21262d; color: #f0f6fc; border: 1px solid #30363d; border-radius: 4px; padding: 4px 8px; font-size: 12px;">
                            ${generateOption('all', 'All Times', this.networkFilters.timeRange)}
                            ${generateOption('fast', 'Fast (&lt; 100ms)', this.networkFilters.timeRange)}
                            ${generateOption('medium', 'Medium (100ms - 1s)', this.networkFilters.timeRange)}
                            ${generateOption('slow', 'Slow (&gt; 1s)', this.networkFilters.timeRange)}
                        </select>
                    </div>
                    
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <input type="text" id="network-search" placeholder="Filter by name, URL, or headers..." value="${this.networkFilters.search}" style="background: #21262d; color: #f0f6fc; border: 1px solid #30363d; border-radius: 4px; padding: 4px 8px; font-size: 12px; width: 200px;">
                    </div>
                    
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <button id="clear-network" style="background: #db2c3a; color: white; border: none; border-radius: 4px; padding: 4px 12px; font-size: 12px; cursor: pointer; transition: background 0.2s;">Clear All</button>
                        <button id="reset-filters" style="background: #6366f1; color: white; border: none; border-radius: 4px; padding: 4px 12px; font-size: 12px; cursor: pointer; transition: background 0.2s;">Reset Filters</button>
                        <button id="export-network" style="background: #238636; color: white; border: none; border-radius: 4px; padding: 4px 12px; font-size: 12px; cursor: pointer; transition: background 0.2s;">Export HAR</button>
                    </div>
                </div>
                
                <!-- Enhanced Load Statistics -->
                <div style="display: flex; flex-wrap: wrap; gap: 16px; padding: 10px; background: rgba(255, 255, 255, 0.02); border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.05);">
                    <div style="font-size: 12px;"><span style="color: #8b949e;">Requests:</span> <span style="color: #58a6ff; font-weight: 600;">${loadStats.totalRequests}</span></div>
                    <div style="font-size: 12px;"><span style="color: #8b949e;">Transferred:</span> <span style="color: #39d353; font-weight: 600;">${this.formatBytes(loadStats.totalTransferredSize)}</span></div>
                    <div style="font-size: 12px;"><span style="color: #8b949e;">Resources:</span> <span style="color: #ffab70; font-weight: 600;">${this.formatBytes(loadStats.totalSize)}</span></div>
                    <div style="font-size: 12px;"><span style="color: #8b949e;">Finish:</span> <span style="color: #f85149; font-weight: 600;">${loadStats.finishTime}ms</span></div>
                    <div style="font-size: 12px;"><span style="color: #8b949e;">DOMContentLoaded:</span> <span style="color: #a5a5a5; font-weight: 600;">${loadStats.domContentLoaded}ms</span></div>
                    ${loadStats.totalRequests > 0 ? `
                    <div style="font-size: 12px;"><span style="color: #8b949e;">Avg Size:</span> <span style="color: #8b949e; font-weight: 600;">${this.formatBytes(loadStats.totalSize / loadStats.totalRequests)}</span></div>
                    <div style="font-size: 12px;"><span style="color: #8b949e;">Cache Hit:</span> <span style="color: #39d353; font-weight: 600;">${Math.round((requests.filter(r => r.fromCache).length / requests.length) * 100)}%</span></div>
                    ` : ''}
                </div>
            </div>

            <!-- Enhanced Network Table -->
            <div class="network-table-container" style="overflow-x: auto; border: 1px solid #21262d; border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.2);">
                <table class="network-table" style="width: 100%; border-collapse: collapse; font-size: 12px; background: #0d1117;">
                    <thead>
                        <tr style="background: #161b22; color: #f0f6fc; border-bottom: 1px solid #21262d; position: sticky; top: 0; z-index: 10;">
                            <th style="padding: 8px 6px; text-align: left; font-weight: 600; min-width: 40px; border-right: 1px solid #21262d;">Type</th>
                            <th style="padding: 8px 6px; text-align: left; font-weight: 600; min-width: 60px; border-right: 1px solid #21262d;">Method</th>
                            <th style="padding: 8px 6px; text-align: left; font-weight: 600; min-width: 200px; border-right: 1px solid #21262d;">Name</th>
                            <th style="padding: 8px 6px; text-align: left; font-weight: 600; min-width: 60px; border-right: 1px solid #21262d;">Status</th>
                            <th style="padding: 8px 6px; text-align: left; font-weight: 600; min-width: 80px; border-right: 1px solid #21262d;">Initiator</th>
                            <th style="padding: 8px 6px; text-align: right; font-weight: 600; min-width: 70px; border-right: 1px solid #21262d;">Size</th>
                            <th style="padding: 8px 6px; text-align: right; font-weight: 600; min-width: 60px; border-right: 1px solid #21262d;">Time</th>
                            <th style="padding: 8px 6px; text-align: left; font-weight: 600; min-width: 120px;">Waterfall</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.generateNetworkTableRows(requests)}
                    </tbody>
                </table>
            </div>
        `;
    }

    /**
     * Generate table rows for network requests
     */
    static generateNetworkTableRows(requests) {
        return requests.slice().reverse().map(req => {
            const statusColor = this.getStatusColor(req.status, req.statusCode);
            const sizeDisplay = this.formatSizeDisplay(req);
            const waterfallBar = this.generateWaterfallBar(req);

            return `
                <tr style="border-bottom: 1px solid #21262d; hover: background: #161b22;" class="network-row" data-request-id="${req.id}">
                    <td style="padding: 6px; color: ${req.typeColor}; text-align: center;">
                        <span title="${req.type}">${req.typeIcon}</span>
                    </td>
                    <td style="padding: 6px; color: #58a6ff; font-weight: 600; font-family: monospace;">
                        ${req.method || 'GET'}
                    </td>
                    <td style="padding: 6px; color: #f0f6fc; max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${req.name || req.url}">
                        ${this.formatResourceName(req.name || req.url)}
                        ${req.fromCache ? '<span style="color: #39d353; font-size: 10px; margin-left: 4px;">(cached)</span>' : ''}
                    </td>
                    <td style="padding: 6px; color: ${statusColor}; font-family: monospace;">
                        ${req.statusCode || ''} ${req.statusText || req.status}
                    </td>
                    <td style="padding: 6px; color: #8b949e; font-size: 11px; max-width: 120px; overflow: hidden; text-overflow: ellipsis;">
                        ${req.initiator || 'Unknown'}
                    </td>
                    <td style="padding: 6px; color: #8b949e; text-align: right; font-family: monospace;">
                        ${sizeDisplay}
                    </td>
                    <td style="padding: 6px; color: #8b949e; text-align: right; font-family: monospace;">
                        ${req.duration ? req.duration + 'ms' : '...'}
                    </td>
                    <td style="padding: 6px; width: 120px;">
                        ${waterfallBar}
                    </td>
                </tr>
            `;
        }).join('');
    }

    /**
     * Apply network filters to requests with enhanced Chrome DevTools-like filtering
     */
    static applyNetworkFilters(requests) {
        return requests.filter(req => {
            // Type filter
            if (this.networkFilters.resourceType !== 'all' && req.type !== this.networkFilters.resourceType) {
                return false;
            }

            // Status filter
            if (this.networkFilters.status !== 'all' && req.status !== this.networkFilters.status) {
                return false;
            }

            // Method filter
            if (this.networkFilters.method !== 'all' && req.method !== this.networkFilters.method) {
                return false;
            }

            // Domain filter
            if (this.networkFilters.domain !== 'all') {
                const requestDomain = this.getDomainFromUrl(req.url);
                if (requestDomain !== this.networkFilters.domain) {
                    return false;
                }
            }

            // Cache filter
            if (this.networkFilters.fromCache !== 'all') {
                if (this.networkFilters.fromCache === 'cached' && !req.fromCache) {
                    return false;
                }
                if (this.networkFilters.fromCache === 'not-cached' && req.fromCache) {
                    return false;
                }
            }

            // Size filter
            if (this.networkFilters.sizeRange !== 'all') {
                const size = req.transferredSize || req.size || 0;
                switch (this.networkFilters.sizeRange) {
                    case 'small':
                        if (size >= 1024) return false;
                        break;
                    case 'medium':
                        if (size < 1024 || size > 102400) return false;
                        break;
                    case 'large':
                        if (size <= 102400) return false;
                        break;
                    default:
                        break;
                }
            }

            // Time filter
            if (this.networkFilters.timeRange !== 'all' && req.duration) {
                switch (this.networkFilters.timeRange) {
                    case 'fast':
                        if (req.duration >= 100) return false;
                        break;
                    case 'medium':
                        if (req.duration < 100 || req.duration > 1000) return false;
                        break;
                    case 'slow':
                        if (req.duration <= 1000) return false;
                        break;
                    default:
                        break;
                }
            }

            // Search filter (enhanced to search in multiple fields)
            if (this.networkFilters.search) {
                const searchLower = this.networkFilters.search.toLowerCase();
                const matchesName = (req.name || req.url || '').toLowerCase().includes(searchLower);
                const matchesMethod = (req.method || '').toLowerCase().includes(searchLower);
                const matchesStatus = (req.statusText || '').toLowerCase().includes(searchLower);
                const matchesInitiator = (req.initiator || '').toLowerCase().includes(searchLower);
                const matchesHeaders = req.responseHeaders &&
                    Object.keys(req.responseHeaders).some(key =>
                        key.toLowerCase().includes(searchLower) ||
                        req.responseHeaders[key].toLowerCase().includes(searchLower)
                    );

                if (!matchesName && !matchesMethod && !matchesStatus && !matchesInitiator && !matchesHeaders) {
                    return false;
                }
            }

            return true;
        });
    }

    /**
     * Helper methods for enhanced network panel
     */
    static getDomainFromUrl(url) {
        try {
            return new URL(url).hostname;
        } catch {
            return null;
        }
    }

    static truncateText(text, maxLength) {
        if (!text) return '';
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    }

    /**
     * Guess content type from URL extension
     */
    static guessContentTypeFromUrl(url) {
        const urlLower = url.toLowerCase();

        if (urlLower.includes('.css')) return 'text/css';
        if (urlLower.includes('.js') || urlLower.includes('.mjs')) return 'application/javascript';
        if (urlLower.includes('.json')) return 'application/json';
        if (urlLower.includes('.html') || urlLower.includes('.htm')) return 'text/html';
        if (urlLower.includes('.xml')) return 'application/xml';
        if (urlLower.includes('.png')) return 'image/png';
        if (urlLower.includes('.jpg') || urlLower.includes('.jpeg')) return 'image/jpeg';
        if (urlLower.includes('.gif')) return 'image/gif';
        if (urlLower.includes('.svg')) return 'image/svg+xml';
        if (urlLower.includes('.webp')) return 'image/webp';
        if (urlLower.includes('.woff')) return 'font/woff';
        if (urlLower.includes('.woff2')) return 'font/woff2';
        if (urlLower.includes('.ttf')) return 'font/ttf';
        if (urlLower.includes('.mp4')) return 'video/mp4';
        if (urlLower.includes('.webm')) return 'video/webm';
        if (urlLower.includes('.mp3')) return 'audio/mpeg';
        if (urlLower.includes('.wav')) return 'audio/wav';

        return 'application/octet-stream';
    }    /**
     * Helper methods for enhanced network panel
     */
    static getStatusColor(status, statusCode) {
        if (status === 'failed') return '#f85149';
        if (status === 'pending') return '#ffab70';
        if (statusCode >= 200 && statusCode < 300) return '#39d353';
        if (statusCode >= 300 && statusCode < 400) return '#58a6ff';
        if (statusCode >= 400) return '#f85149';
        return '#8b949e';
    }

    static formatSizeDisplay(req) {
        if (req.fromCache) {
            return `<span style="color: #39d353;">${this.formatBytes(req.size)}</span>`;
        }

        if (req.size && req.transferredSize && req.size !== req.transferredSize) {
            return `${this.formatBytes(req.transferredSize)} / ${this.formatBytes(req.size)}`;
        }

        return this.formatBytes(req.transferredSize || req.size || 0);
    }

    static formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    static formatResourceName(name) {
        if (!name) return 'Unknown';

        // Extract just the file name from full URLs
        const parts = name.split('/');
        const fileName = parts[parts.length - 1];

        if (fileName.length > 50) {
            return fileName.substring(0, 47) + '...';
        }

        return fileName || name;
    }

    static generateWaterfallBar(req) {
        if (!req.duration || req.duration <= 0) {
            return '<div style="color: #8b949e; font-size: 10px;">...</div>';
        }

        const maxBarWidth = 120; // pixels
        const duration = req.duration;

        // Create a more detailed waterfall like Chrome DevTools
        if (req.loadTiming && (req.loadTiming.domainLookup || req.loadTiming.connect || req.loadTiming.request || req.loadTiming.response)) {
            const timing = req.loadTiming;
            const total = timing.domainLookup + timing.connect + timing.request + timing.response;

            if (total > 0) {
                const scale = Math.min(duration / 10, maxBarWidth) / total;

                return `
                    <div style="display: flex; align-items: center; gap: 4px;">
                        <div style="display: flex; height: 12px; border-radius: 2px; overflow: hidden; min-width: 30px;">
                            ${timing.domainLookup > 0 ? `<div style="background: #58a6ff; width: ${timing.domainLookup * scale}px;" title="DNS Lookup: ${timing.domainLookup}ms"></div>` : ''}
                            ${timing.connect > 0 ? `<div style="background: #ffab70; width: ${timing.connect * scale}px;" title="Connect: ${timing.connect}ms"></div>` : ''}
                            ${timing.request > 0 ? `<div style="background: #39d353; width: ${timing.request * scale}px;" title="Request: ${timing.request}ms"></div>` : ''}
                            ${timing.response > 0 ? `<div style="background: #a5a5a5; width: ${timing.response * scale}px;" title="Response: ${timing.response}ms"></div>` : ''}
                        </div>
                        <span style="font-size: 10px; color: #8b949e;">${duration}ms</span>
                    </div>
                `;
            }
        }

        // Fallback to simple bar
        const normalizedWidth = Math.min(duration / 10, maxBarWidth);
        let barColor = '#39d353'; // Default green
        if (duration > 1000) barColor = '#f85149'; // Red for slow
        else if (duration > 500) barColor = '#ffab70'; // Orange for medium

        return `
            <div style="display: flex; align-items: center; gap: 4px;">
                <div style="
                    width: ${normalizedWidth}px; 
                    height: 12px; 
                    background: ${barColor}; 
                    border-radius: 2px;
                    opacity: 0.7;
                " title="Total: ${duration}ms"></div>
                <span style="font-size: 10px; color: #8b949e;">${duration}ms</span>
            </div>
        `;
    }

    static calculateSessionLoadStats(requests) {
        const stats = {
            totalRequests: requests.length,
            totalSize: 0,
            totalTransferredSize: 0,
            finishTime: 0,
            domContentLoaded: this.loadStats.domContentLoadedTime || 0
        };

        requests.forEach(req => {
            if (req.status === 'completed') {
                stats.totalSize += req.size || 0;
                stats.totalTransferredSize += req.transferredSize || 0;
                if (req.responseEnd) {
                    stats.finishTime = Math.max(stats.finishTime, req.responseEnd - req.startTime);
                }
            }
        });

        return stats;
    }

    /**
     * Attach event handlers for network panel interactions
     */
    static attachNetworkPanelEventHandlers(panel, session) {
        // Filter handlers
        const typeFilter = panel.querySelector('#network-type-filter');
        const statusFilter = panel.querySelector('#network-status-filter');
        const methodFilter = panel.querySelector('#network-method-filter');
        const domainFilter = panel.querySelector('#network-domain-filter');
        const cacheFilter = panel.querySelector('#network-cache-filter');
        const sizeFilter = panel.querySelector('#network-size-filter');
        const timeFilter = panel.querySelector('#network-time-filter');
        const searchInput = panel.querySelector('#network-search');
        const clearButton = panel.querySelector('#clear-network');
        const resetFiltersButton = panel.querySelector('#reset-filters');
        const exportButton = panel.querySelector('#export-network');

        // Type filter handler
        if (typeFilter) {
            typeFilter.addEventListener('change', (e) => {
                this.networkFilters.resourceType = e.target.value;
                this.renderEnhancedNetworkPanel();
            });
        }

        // Status filter handler
        if (statusFilter) {
            statusFilter.addEventListener('change', (e) => {
                this.networkFilters.status = e.target.value;
                this.renderEnhancedNetworkPanel();
            });
        }

        // Method filter handler
        if (methodFilter) {
            methodFilter.addEventListener('change', (e) => {
                this.networkFilters.method = e.target.value;
                this.renderEnhancedNetworkPanel();
            });
        }

        // Domain filter handler
        if (domainFilter) {
            domainFilter.addEventListener('change', (e) => {
                this.networkFilters.domain = e.target.value;
                this.renderEnhancedNetworkPanel();
            });
        }

        // Cache filter handler
        if (cacheFilter) {
            cacheFilter.addEventListener('change', (e) => {
                this.networkFilters.fromCache = e.target.value;
                this.renderEnhancedNetworkPanel();
            });
        }

        // Size filter handler
        if (sizeFilter) {
            sizeFilter.addEventListener('change', (e) => {
                this.networkFilters.sizeRange = e.target.value;
                this.renderEnhancedNetworkPanel();
            });
        }

        // Time filter handler
        if (timeFilter) {
            timeFilter.addEventListener('change', (e) => {
                this.networkFilters.timeRange = e.target.value;
                this.renderEnhancedNetworkPanel();
            });
        }

        // Search input handler
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.networkFilters.search = e.target.value;
                this.renderEnhancedNetworkPanel();
            });
        }

        // Clear button handler
        if (clearButton) {
            clearButton.addEventListener('click', () => {
                if (window.confirm('Clear all network requests from this session?')) {
                    session.networkRequests = [];
                    this.loadStats = {
                        totalRequests: 0,
                        totalSize: 0,
                        totalTransferredSize: 0,
                        totalTime: 0,
                        domContentLoadedTime: null,
                        loadTime: null,
                        resourcesByType: {}
                    };
                    this.renderEnhancedNetworkPanel();
                }
            });
        }

        // Reset filters button handler
        if (resetFiltersButton) {
            resetFiltersButton.addEventListener('click', () => {
                // Reset all filters to default values
                this.networkFilters = {
                    resourceType: 'all',
                    status: 'all',
                    method: 'all',
                    domain: 'all',
                    protocol: 'all',
                    search: '',
                    showCacheOnly: false,
                    showErrors: false,
                    sizeRange: 'all',
                    timeRange: 'all',
                    mimeType: 'all',
                    hasResponseHeaders: 'all',
                    fromCache: 'all',
                    priority: 'all'
                };
                this.renderEnhancedNetworkPanel();
            });
        }

        // Export HAR button handler
        if (exportButton) {
            exportButton.addEventListener('click', () => {
                this.exportNetworkAsHAR(session.networkRequests);
            });
        }

        // Row click handlers for detailed view
        panel.querySelectorAll('.network-row').forEach(row => {
            row.addEventListener('click', () => {
                const requestId = row.getAttribute('data-request-id');
                const req = session.networkRequests.find(r => r.id === requestId);
                if (req) {
                    this.showEnhancedRequestDetails(req);
                }
            });
        });
    }

    /**
     * Export network requests as HAR (HTTP Archive) format
     */
    static exportNetworkAsHAR(requests) {
        const har = {
            log: {
                version: "1.2",
                creator: {
                    name: "Pigeon API Designer",
                    version: "1.0.0"
                },
                browser: {
                    name: navigator.userAgent.split(' ')[0],
                    version: navigator.userAgent
                },
                pages: [{
                    startedDateTime: new Date().toISOString(),
                    id: "page_1",
                    title: document.title || "API Debug Session",
                    pageTimings: {
                        onContentLoad: this.loadStats.domContentLoadedTime || -1,
                        onLoad: this.loadStats.loadTime || -1
                    }
                }],
                entries: requests.map(req => ({
                    pageref: "page_1",
                    startedDateTime: new Date(req.timestamp || Date.now()).toISOString(),
                    time: req.duration || 0,
                    request: {
                        method: req.method || "GET",
                        url: req.url || req.name,
                        httpVersion: "HTTP/1.1",
                        headers: req.requestHeaders ? Object.keys(req.requestHeaders).map(key => ({
                            name: key,
                            value: req.requestHeaders[key]
                        })) : [],
                        queryString: [],
                        postData: req.requestData ? {
                            mimeType: "application/json",
                            text: typeof req.requestData === 'string' ? req.requestData : JSON.stringify(req.requestData)
                        } : undefined,
                        headersSize: -1,
                        bodySize: req.requestData ? (typeof req.requestData === 'string' ? req.requestData.length : JSON.stringify(req.requestData).length) : 0
                    },
                    response: {
                        status: req.statusCode || 0,
                        statusText: req.statusText || "",
                        httpVersion: "HTTP/1.1",
                        headers: req.responseHeaders ? Object.keys(req.responseHeaders).map(key => ({
                            name: key,
                            value: req.responseHeaders[key]
                        })) : [],
                        content: {
                            size: req.size || 0,
                            mimeType: req.contentType || "application/octet-stream",
                            text: req.responseData || ""
                        },
                        redirectURL: "",
                        headersSize: -1,
                        bodySize: req.transferredSize || req.size || 0
                    },
                    cache: req.fromCache ? {
                        beforeRequest: {
                            lastAccess: new Date().toISOString(),
                            eTag: "",
                            hitCount: 1
                        }
                    } : {},
                    timings: {
                        blocked: -1,
                        dns: req.loadTiming?.domainLookup || -1,
                        connect: req.loadTiming?.connect || -1,
                        send: req.loadTiming?.request || -1,
                        wait: req.loadTiming?.response || -1,
                        receive: 0,
                        ssl: req.loadTiming?.secureConnect || -1
                    }
                }))
            }
        };

        // Download HAR file
        const blob = new Blob([JSON.stringify(har, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `network-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.har`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Show enhanced request details modal
     */
    static showEnhancedRequestDetails(req) {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(0, 0, 0, 0.8); z-index: 10000;
            display: flex; align-items: center; justify-content: center;
        `;

        modal.innerHTML = `
            <div style="
                background: #0d1117; color: #f0f6fc; padding: 24px; border-radius: 12px;
                max-width: 90vw; max-height: 90vh; overflow-y: auto; border: 1px solid #21262d;
                box-shadow: 0 16px 32px rgba(0, 0, 0, 0.5);
            ">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h3 style="margin: 0; color: #58a6ff; font-size: 18px;">
                        ${req.typeIcon} ${req.type.toUpperCase()} Request Details
                    </h3>
                    <button id="close-modal" style="
                        background: #21262d; color: #f0f6fc; border: none; 
                        border-radius: 6px; padding: 8px 12px; cursor: pointer;
                    ">✕ Close</button>
                </div>

                <!-- General Information -->
                <div style="margin-bottom: 20px;">
                    <h4 style="color: #ff7b72; margin-bottom: 8px;">General</h4>
                    <div style="background: #161b22; padding: 12px; border-radius: 6px; font-family: monospace; font-size: 13px;">
                        <div><span style="color: #79c0ff;">Request URL:</span> ${req.url}</div>
                        <div><span style="color: #79c0ff;">Method:</span> ${req.method}</div>
                        <div><span style="color: #79c0ff;">Status Code:</span> ${req.statusCode} ${req.statusText}</div>
                        <div><span style="color: #79c0ff;">Resource Type:</span> ${req.type}</div>
                        <div><span style="color: #79c0ff;">Initiator:</span> ${req.initiator}</div>
                        <div><span style="color: #79c0ff;">Priority:</span> ${req.priority}</div>
                        ${req.fromCache ? '<div><span style="color: #79c0ff;">Cache Status:</span> <span style="color: #39d353;">From Cache</span></div>' : ''}
                    </div>
                </div>

                <!-- Timing Information -->
                ${req.loadTiming ? `
                <div style="margin-bottom: 20px;">
                    <h4 style="color: #ff7b72; margin-bottom: 8px;">Timing</h4>
                    <div style="background: #161b22; padding: 12px; border-radius: 6px; font-family: monospace; font-size: 13px;">
                        <div><span style="color: #79c0ff;">Total Time:</span> ${req.duration}ms</div>
                        ${req.loadTiming.domainLookup ? `<div><span style="color: #79c0ff;">DNS Lookup:</span> ${req.loadTiming.domainLookup.toFixed(2)}ms</div>` : ''}
                        ${req.loadTiming.connect ? `<div><span style="color: #79c0ff;">TCP Connect:</span> ${req.loadTiming.connect.toFixed(2)}ms</div>` : ''}
                        ${req.loadTiming.request ? `<div><span style="color: #79c0ff;">Request:</span> ${req.loadTiming.request.toFixed(2)}ms</div>` : ''}
                        ${req.loadTiming.response ? `<div><span style="color: #79c0ff;">Response:</span> ${req.loadTiming.response.toFixed(2)}ms</div>` : ''}
                    </div>
                </div>
                ` : ''}

                <!-- Size Information -->
                <div style="margin-bottom: 20px;">
                    <h4 style="color: #ff7b72; margin-bottom: 8px;">Size</h4>
                    <div style="background: #161b22; padding: 12px; border-radius: 6px; font-family: monospace; font-size: 13px;">
                        <div><span style="color: #79c0ff;">Resource Size:</span> ${this.formatBytes(req.size || 0)}</div>
                        <div><span style="color: #79c0ff;">Transferred Size:</span> ${this.formatBytes(req.transferredSize || 0)}</div>
                        ${req.fromCache ? '<div><span style="color: #79c0ff;">Saved by Cache:</span> <span style="color: #39d353;">' + this.formatBytes(req.size || 0) + '</span></div>' : ''}
                    </div>
                </div>

                <!-- Headers -->
                ${req.responseHeaders ? `
                <div style="margin-bottom: 20px;">
                    <h4 style="color: #ff7b72; margin-bottom: 8px;">Response Headers</h4>
                    <div style="background: #161b22; padding: 12px; border-radius: 6px; max-height: 200px; overflow-y: auto;">
                        <pre style="margin: 0; font-size: 12px; color: #e6edf3;">${JSON.stringify(req.responseHeaders, null, 2)}</pre>
                    </div>
                </div>
                ` : ''}

                <!-- Request Data -->
                ${req.requestData ? `
                <div style="margin-bottom: 20px;">
                    <h4 style="color: #ff7b72; margin-bottom: 8px;">Request Payload</h4>
                    <div style="background: #161b22; padding: 12px; border-radius: 6px; max-height: 200px; overflow-y: auto;">
                        <pre style="margin: 0; font-size: 12px; color: #e6edf3;">${typeof req.requestData === 'string' ? req.requestData : JSON.stringify(req.requestData, null, 2)}</pre>
                    </div>
                </div>
                ` : ''}

                ${req.error ? `
                <div style="margin-bottom: 20px;">
                    <h4 style="color: #f85149; margin-bottom: 8px;">Error Information</h4>
                    <div style="background: #161b22; padding: 12px; border-radius: 6px; border-left: 3px solid #f85149;">
                        <div style="color: #f85149; font-family: monospace;">${req.error}</div>
                    </div>
                </div>
                ` : ''}
            </div>
        `;

        document.body.appendChild(modal);

        // Event handlers
        modal.querySelector('#close-modal').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
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
        // Never show internal debug logs in the console tab
        if (logEntry.source === 'internal') {
            return false;
        }

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
     * Start capturing console logs from external website
     * 
     * NOTE: This functionality has been optimized to prevent excessive logging issues.
     */
    static async startBrowserConsoleCapture(url) {
        if (!url || url === 'no-url') {
            this.log('⚠️ Cannot capture console logs - no valid URL provided', 'warn');
            return false;
        }

        try {
            // Stop any existing browser capture
            await this.stopBrowserConsoleCapture();

            // Use current debug session or default
            const debugSessionId = this.currentSessionId || this.getActiveSessionId() || 'default-session';
            const sessionId = `browser-${debugSessionId}`;

            this.log(`🌐 Starting browser console capture for: ${url}`, 'info', null, debugSessionId);

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
                        this.displayExternalWebsiteLog(log, debugSessionId);
                    });
                }

                // Start polling with controlled frequency
                this.startBrowserCapturePolling();

                this.log(`✅ Browser console capture started successfully`, 'success', null, debugSessionId);
                this.log(`📊 Capturing real-time console logs from ${url}`, 'info', null, debugSessionId);

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
     * OPTIMIZED to prevent excessive logging and network requests
     */
    static startBrowserCapturePolling() {
        // Clear any existing polling
        if (this._browserCapturePolling) {
            clearInterval(this._browserCapturePolling);
            this._browserCapturePolling = null;
        }

        // Make sure we have an active session
        if (!this._browserCaptureSession || !this._browserCaptureSession.sessionId) {
            console.log("[VisualizationDebugger] No browser capture session found, skipping polling");
            return;
        }

        // Get the session ID for logging
        const debugSessionId = this.currentSessionId || this.getActiveSessionId();

        // Set a reasonable polling interval (5 seconds instead of every 1 second)
        // This reduces network requests by 80% while still providing updates
        const pollingInterval = 5000;

        this.log(`📡 Starting browser console capture polling (every ${pollingInterval / 1000}s)`, 'debug', null, debugSessionId);

        // Store the polling function for reuse
        const pollingFunction = async () => {
            try {
                // Make sure we still have an active session
                if (!this._browserCaptureSession || !this._browserCaptureSession.sessionId) {
                    return;
                }

                // Limit requests per session to prevent overloading
                const now = Date.now();
                if (this._browserCaptureSession.lastRequestTime &&
                    now - this._browserCaptureSession.lastRequestTime < pollingInterval) {
                    return;
                }

                this._browserCaptureSession.lastRequestTime = now;

                // Fetch new logs since last check
                const response = await fetch(`/api/console-capture/${this._browserCaptureSession.sessionId}/logs?since=${this._browserCaptureSession.lastLogTime}`, {
                    method: 'GET'
                });

                const result = await response.json();

                if (result.success && result.logs && result.logs.length > 0) {
                    // Update last log time
                    this._browserCaptureSession.lastLogTime = Date.now();

                    // Display new logs (limit to 50 at a time to prevent flooding)
                    const logsToShow = result.logs.slice(0, 50);
                    if (logsToShow.length > 0) {
                        // Use the session ID from the browser capture session
                        const sessionIdForLogs = this._browserCaptureSession.sessionId.replace('browser-', '');

                        logsToShow.forEach(log => {
                            this.displayExternalWebsiteLog(log, sessionIdForLogs);
                        });

                        // If we had to limit logs, show a message
                        if (result.logs.length > 50) {
                            this.log(`⚠️ Showing only 50 of ${result.logs.length} new logs to prevent flooding`, 'warn', null, sessionIdForLogs);
                        }
                    }
                }
            } catch (error) {
                console.warn('[VizDebugger] Error polling for console logs:', error);
                // If we encounter errors, slow down polling to avoid error spamming
                if (this._browserCapturePolling) {
                    clearInterval(this._browserCapturePolling);
                    this._browserCapturePolling = setInterval(pollingFunction, pollingInterval * 2);
                }
            }
        };

        // Start the polling with our function
        this._browserCapturePolling = setInterval(pollingFunction, pollingInterval);
    }

    /**
     * Display external website console log in debug panel
     */
    static displayExternalWebsiteLog(log, debugSessionId = null) {
        // Skip empty or undefined messages
        const logText = log.text || log.message || '';
        if (!logText || logText === 'undefined' || logText === 'null' || logText.trim() === '') {
            return;
        }

        // Use provided session ID or try to get the current active session
        const sessionId = debugSessionId || this.currentSessionId || this.getActiveSessionId() || 'default-session';

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
        let data = log.data || null;
        if (log.args && log.args.length > 0) {
            data = {
                args: log.args,
                location: log.location,
                source: log.source,
                ...(data || {})
            };
        }

        // Add log entry to the session - use only one logging method
        this.addLog(sessionId, mappedType, message, data);
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
        if (session && session.logs && session.logs.length > 0) {
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
        } else {
            // If no logs, show the welcome message
            consoleOutput.innerHTML = `
                <div class="console-welcome-message">
                    <div class="welcome-icon">🚀</div>
                    <div class="welcome-content">
                        <div class="welcome-title">Debug Console Initialized</div>
                        <div class="welcome-subtitle">Start debugging to see request/response logs, network activity, and system events</div>
                    </div>
                </div>
            `;
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

    // END OF CLASS
}

// Make VisualizationDebugger globally available for testing
if (typeof window !== 'undefined') {
    window.VisualizationDebugger = VisualizationDebugger;
}


export default VisualizationDebugger;
