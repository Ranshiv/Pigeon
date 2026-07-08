const puppeteer = require('puppeteer');

/**
 * Browser Console Service
 * Captures real-time console logs from external websites using Puppeteer
 */
class BrowserConsoleService {
    constructor() {
        this.activeSessions = new Map();
        this.browser = null;
    }

    /**
     * Initialize browser instance
     */
    async initialize() {
        if (!this.browser) {
            try {
                this.browser = await puppeteer.launch({
                    headless: true,
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-web-security',
                        '--disable-features=VizDisplayCompositor'
                    ]
                });
                console.log('Browser Console Service initialized');
            } catch (error) {
                console.error('Failed to initialize browser:', error);
                throw error;
            }
        }
        return this.browser;
    }

    /**
     * Start capturing console logs for a specific URL
     */
    async startCapture(sessionId, url, callback) {
        try {
            await this.initialize();

            // Close existing session if any
            await this.stopCapture(sessionId);

            const page = await this.browser.newPage();

            // Set user agent and viewport to avoid detection
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            await page.setViewport({ width: 1280, height: 720 });

            // Set up console listener before navigating
            const consoleLogs = [];
            page.on('console', (msg) => {
                try {
                    const type = msg.type();
                    let text = msg.text();
                    const location = msg.location();

                    // Handle cases where text might be undefined, null, or empty
                    if (!text || text === 'undefined' || text === 'null' || text.trim() === '') {
                        // Try to get text from args if main text is empty
                        const args = msg.args();
                        if (args && args.length > 0) {
                            try {
                                text = args.map(arg => arg.toString()).join(' ');
                            } catch (e) {
                                text = `[${type}] Console message (content unavailable)`;
                            }
                        } else {
                            // Skip completely empty messages
                            return;
                        }
                    }

                    const logEntry = {
                        type: type,
                        text: text,
                        message: text, // Keep both for compatibility
                        location: location,
                        timestamp: new Date().toISOString(),
                        url: url,
                        source: 'external-website'
                    };

                    consoleLogs.push(logEntry);
                    console.log(`Console Log [${type}]: ${text}`);

                    // Send to callback immediately for real-time logging
                    if (callback) {
                        callback(logEntry);
                    }
                } catch (error) {
                    console.error('Error processing console message:', error);
                }
            });

            // Set up error listener
            page.on('pageerror', (error) => {
                const logEntry = {
                    type: 'error',
                    message: `Page Error: ${error.message}`,
                    location: { url: url },
                    timestamp: new Date().toISOString(),
                    url: url
                };

                consoleLogs.push(logEntry);

                if (callback) {
                    callback(logEntry);
                }
            });

            // Set up request failure listener
            page.on('requestfailed', (request) => {
                const logEntry = {
                    type: 'error',
                    message: `Request Failed: ${request.url()} - ${request.failure().errorText}`,
                    location: { url: request.url() },
                    timestamp: new Date().toISOString(),
                    url: url
                };

                consoleLogs.push(logEntry);

                if (callback) {
                    callback(logEntry);
                }
            });

            // Store session info
            this.activeSessions.set(sessionId, {
                page: page,
                url: url,
                logs: consoleLogs,
                startTime: Date.now()
            });

            // Navigate to the URL with more lenient wait conditions
            await page.goto(url, {
                waitUntil: 'domcontentloaded',
                timeout: 30000
            });

            // Wait for initial page load and scripts to execute
            await new Promise(resolve => setTimeout(resolve, 3000));

            // Try to inject test console messages to verify it's working
            // Only if the page is still attached and ready
            try {
                const isPageReady = await page.evaluate(() => {
                    return document.readyState === 'complete' || document.readyState === 'interactive';
                });

                if (isPageReady) {
                    await page.evaluate(() => {
                        console.log('🚀 Pigeon Console Capture - Connection established');
                        console.log('✅ Real-time console monitoring is active');
                    });
                }
            } catch (evalError) {
                // If we can't inject test messages, that's okay - we'll still capture real console logs
                console.log('Note: Could not inject test messages, but console capture is still active');
            }

            return {
                success: true,
                sessionId: sessionId,
                url: url,
                message: 'Browser console capture started successfully',
                initialLogs: consoleLogs // Include any logs captured during initialization
            };

        } catch (error) {
            console.error('Failed to start browser console capture:', error);

            // Clean up on error
            await this.stopCapture(sessionId);

            return {
                success: false,
                error: error.message,
                sessionId: sessionId,
                url: url
            };
        }
    }

    /**
     * Stop capturing console logs for a session
     */
    async stopCapture(sessionId) {
        const session = this.activeSessions.get(sessionId);
        if (session) {
            try {
                await session.page.close();
            } catch (error) {
                console.error('Error closing page:', error);
            }
            this.activeSessions.delete(sessionId);
            return { success: true, message: 'Console capture stopped' };
        }
        return { success: false, message: 'No active session found' };
    }

    /**
     * Get captured logs for a session
     */
    getSessionLogs(sessionId) {
        const session = this.activeSessions.get(sessionId);
        return session ? session.logs : [];
    }

    /**
     * Execute JavaScript in an active captured page session
     */
    async executeScript(sessionId, script, waitMs = 500) {
        const session = this.activeSessions.get(sessionId);

        if (!session) {
            return {
                success: false,
                error: 'Session not found'
            };
        }

        if (!script || typeof script !== 'string') {
            return {
                success: false,
                error: 'A valid script string is required'
            };
        }

        try {
            const logsBefore = session.logs.length;

            const result = await session.page.evaluate((scriptSource) => {
                // eslint-disable-next-line no-new-func
                const execute = new Function(scriptSource);
                return execute();
            }, script);

            if (waitMs > 0) {
                await new Promise(resolve => setTimeout(resolve, waitMs));
            }

            const newLogs = session.logs.slice(logsBefore);

            return {
                success: true,
                sessionId,
                result,
                newLogs,
                executedAt: new Date().toISOString()
            };
        } catch (error) {
            return {
                success: false,
                sessionId,
                error: error.message
            };
        }
    }

    /**
     * Get all active sessions
     */
    getActiveSessions() {
        return Array.from(this.activeSessions.keys()).map(sessionId => {
            const session = this.activeSessions.get(sessionId);
            return {
                sessionId,
                url: session.url,
                startTime: session.startTime,
                logCount: session.logs.length
            };
        });
    }

    /**
     * Cleanup all sessions and close browser
     */
    async cleanup() {
        console.log('Cleaning up Browser Console Service...');

        // Close all active sessions
        for (const sessionId of this.activeSessions.keys()) {
            await this.stopCapture(sessionId);
        }

        // Close browser
        if (this.browser) {
            try {
                await this.browser.close();
                this.browser = null;
                console.log('Browser closed successfully');
            } catch (error) {
                console.error('Error closing browser:', error);
            }
        }
    }
}

// Export singleton instance
const browserConsoleService = new BrowserConsoleService();

// Note: process-level SIGINT/SIGTERM handlers removed — server.js owns the
// shutdown sequence and calls browserConsoleService.cleanup() itself. Duplicate
// handlers here raced server.close() and could exit before sockets drained.

module.exports = browserConsoleService;
