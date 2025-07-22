/**
 * Browser Console Capture Service
 * Uses Puppeteer to capture real-time console logs from external websites
 */

const puppeteer = require('puppeteer');

class BrowserConsoleCapture {
    static activeSessions = new Map();
    static browser = null;

    /**
     * Initialize browser instance
     */
    static async initialize() {
        if (!this.browser) {
            try {
                this.browser = await puppeteer.launch({
                    headless: true,
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-extensions',
                        '--disable-gpu',
                        '--disable-background-timer-throttling',
                        '--disable-backgrounding-occluded-windows',
                        '--disable-renderer-backgrounding'
                    ]
                });
                console.log('🌐 Browser instance initialized for console capture');
            } catch (error) {
                console.error('Failed to initialize browser:', error);
                throw error;
            }
        }
        return this.browser;
    }

    /**
     * Start capturing console logs from a website
     */
    static async startCapture(sessionId, url, options = {}) {
        try {
            await this.initialize();

            const page = await this.browser.newPage();

            // Set viewport and user agent
            await page.setViewport({ width: 1280, height: 720 });
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

            const session = {
                sessionId,
                url,
                page,
                logs: [],
                startTime: Date.now(),
                isActive: true
            };

            // Listen for console events
            page.on('console', (msg) => {
                if (!session.isActive) return;

                const logEntry = {
                    timestamp: new Date().toISOString(),
                    type: msg.type(),
                    text: msg.text(),
                    location: msg.location(),
                    args: msg.args().map(arg => arg.toString()),
                    source: 'external-website'
                };

                session.logs.push(logEntry);

                // Limit log history to prevent memory issues
                if (session.logs.length > 1000) {
                    session.logs = session.logs.slice(-500);
                }

                console.log(`[CAPTURE:${sessionId}] ${msg.type().toUpperCase()}: ${msg.text()}`);
            });

            // Listen for page errors
            page.on('pageerror', (error) => {
                if (!session.isActive) return;

                const logEntry = {
                    timestamp: new Date().toISOString(),
                    type: 'error',
                    text: error.message,
                    location: { url: page.url() },
                    args: [error.stack],
                    source: 'external-website'
                };

                session.logs.push(logEntry);
                console.log(`[CAPTURE:${sessionId}] PAGE ERROR: ${error.message}`);
            });

            // Listen for request failures
            page.on('requestfailed', (request) => {
                if (!session.isActive) return;

                const logEntry = {
                    timestamp: new Date().toISOString(),
                    type: 'error',
                    text: `Request failed: ${request.url()}`,
                    location: { url: request.url() },
                    args: [request.failure().errorText],
                    source: 'external-website'
                };

                session.logs.push(logEntry);
                console.log(`[CAPTURE:${sessionId}] REQUEST FAILED: ${request.url()} - ${request.failure().errorText}`);
            });

            this.activeSessions.set(sessionId, session);

            // Navigate to the website
            console.log(`🔍 Starting console capture for ${url}`);
            await page.goto(url, {
                waitUntil: 'domcontentloaded',
                timeout: 30000
            });

            // Wait a moment for initial console logs to appear
            await page.waitForTimeout(2000);

            return {
                success: true,
                sessionId,
                url,
                initialLogs: session.logs.slice()
            };

        } catch (error) {
            console.error(`Failed to start console capture for ${url}:`, error);

            // Clean up session if it was created
            if (this.activeSessions.has(sessionId)) {
                const session = this.activeSessions.get(sessionId);
                if (session.page) {
                    try {
                        await session.page.close();
                    } catch (e) {
                        console.error('Error closing page:', e);
                    }
                }
                this.activeSessions.delete(sessionId);
            }

            return {
                success: false,
                error: error.message,
                sessionId,
                url
            };
        }
    }

    /**
     * Get recent console logs from a capture session
     */
    static getRecentLogs(sessionId, since = 0) {
        const session = this.activeSessions.get(sessionId);
        if (!session) {
            return {
                success: false,
                error: 'Session not found',
                logs: []
            };
        }

        const recentLogs = session.logs.filter(log =>
            new Date(log.timestamp).getTime() > since
        );

        return {
            success: true,
            sessionId,
            logs: recentLogs,
            totalLogs: session.logs.length,
            isActive: session.isActive
        };
    }

    /**
     * Stop console capture for a session
     */
    static async stopCapture(sessionId) {
        const session = this.activeSessions.get(sessionId);
        if (!session) {
            return {
                success: false,
                error: 'Session not found'
            };
        }

        try {
            session.isActive = false;

            if (session.page) {
                await session.page.close();
            }

            this.activeSessions.delete(sessionId);

            console.log(`🛑 Console capture stopped for session ${sessionId}`);

            return {
                success: true,
                sessionId,
                totalLogs: session.logs.length,
                duration: Date.now() - session.startTime
            };

        } catch (error) {
            console.error(`Error stopping capture for session ${sessionId}:`, error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Execute JavaScript in the captured page and get console output
     */
    static async executeScript(sessionId, script) {
        const session = this.activeSessions.get(sessionId);
        if (!session || !session.isActive) {
            return {
                success: false,
                error: 'Session not found or inactive'
            };
        }

        try {
            const logsBefore = session.logs.length;

            // Execute the script
            const result = await session.page.evaluate(script);

            // Wait a moment for any console logs to appear
            await session.page.waitForTimeout(500);

            const newLogs = session.logs.slice(logsBefore);

            return {
                success: true,
                result,
                newLogs,
                sessionId
            };

        } catch (error) {
            return {
                success: false,
                error: error.message,
                sessionId
            };
        }
    }

    /**
     * Get all active sessions
     */
    static getActiveSessions() {
        const sessions = [];
        for (const [sessionId, session] of this.activeSessions) {
            sessions.push({
                sessionId,
                url: session.url,
                startTime: session.startTime,
                logCount: session.logs.length,
                isActive: session.isActive
            });
        }
        return sessions;
    }

    /**
     * Clean up all sessions and close browser
     */
    static async cleanup() {
        console.log('🧹 Cleaning up browser console capture...');

        // Stop all active sessions
        const sessionIds = Array.from(this.activeSessions.keys());
        for (const sessionId of sessionIds) {
            await this.stopCapture(sessionId);
        }

        // Close browser
        if (this.browser) {
            try {
                await this.browser.close();
                this.browser = null;
                console.log('🌐 Browser instance closed');
            } catch (error) {
                console.error('Error closing browser:', error);
            }
        }
    }
}

module.exports = BrowserConsoleCapture;
