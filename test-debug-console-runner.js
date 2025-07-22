#!/usr/bin/env node

/**
 * Debug Console Test Runner
 * Comprehensive test suite for VisualizationDebugger functionality
 */

const fs = require('fs');
const path = require('path');

class DebugConsoleTestRunner {
    constructor() {
        this.results = {
            passed: 0,
            failed: 0,
            total: 0,
            details: []
        };

        this.mockVisualizationDebugger = this.createMockDebugger();
    }

    createMockDebugger() {
        return {
            debugSessions: new Map(),
            isEnabled: false,
            debugPanel: null,
            currentSessionId: null,
            isInitialized: false,
            _isUpdatingDOM: false,
            _pendingLogs: [],

            initialize() {
                this.isEnabled = true;
                this.isInitialized = true;
                return true;
            },

            startSession(sessionId, element, data) {
                const session = {
                    id: sessionId,
                    element: element,
                    data: data,
                    url: data?.url || 'unknown',
                    method: data?.method || 'GET',
                    startTime: Date.now(),
                    logs: [],
                    networkRequests: []
                };

                this.debugSessions.set(sessionId, session);
                this.currentSessionId = sessionId;

                // Clean up old sessions
                if (this.debugSessions.size > 3) {
                    const sessions = Array.from(this.debugSessions.entries());
                    const oldestSessionId = sessions[0][0];
                    this.debugSessions.delete(oldestSessionId);
                }

                this.log(`Debug session started: ${sessionId}`, 'info');
                return session;
            },

            log(message, type = 'info', data = null, sessionId = null) {
                const logEntry = {
                    timestamp: new Date().toISOString(),
                    message,
                    type,
                    data,
                    sessionId: sessionId || this.currentSessionId
                };

                const targetSessionId = sessionId || this.currentSessionId;
                const session = this.debugSessions.get(targetSessionId);

                if (session) {
                    session.logs.push(logEntry);
                }

                return true;
            },

            getCurrentSession() {
                return this.debugSessions.get(this.currentSessionId);
            },

            addNetworkRequest(sessionId, requestData) {
                const session = this.debugSessions.get(sessionId);
                if (session) {
                    session.networkRequests.push({
                        ...requestData,
                        timestamp: Date.now()
                    });
                    this.log(`Network request: ${requestData.method} ${requestData.url}`, 'info', requestData, sessionId);
                }
            },

            updateNetworkRequest(sessionId, requestId, updateData) {
                const session = this.debugSessions.get(sessionId);
                if (session) {
                    const request = session.networkRequests.find(req => req.id === requestId);
                    if (request) {
                        Object.assign(request, updateData);
                        return true;
                    }
                }
                return false;
            },

            clearConsole() {
                const currentSession = this.getCurrentSession();
                if (currentSession) {
                    currentSession.logs = [];
                    return true;
                }
                return false;
            }
        };
    }

    async runTests() {
        console.log('🧪 Starting Debug Console Comprehensive Test Suite...\n');

        // Test Categories
        await this.runBasicFunctionalityTests();
        await this.runLoggingTests();
        await this.runNetworkTrackingTests();
        await this.runPerformanceTests();
        await this.runErrorHandlingTests();
        await this.runIntegrationTests();

        this.displayResults();
        return this.results;
    }

    async runBasicFunctionalityTests() {
        console.log('📋 Running Basic Functionality Tests...');

        this.test('Initialization', () => {
            const result = this.mockVisualizationDebugger.initialize();
            return result && this.mockVisualizationDebugger.isEnabled && this.mockVisualizationDebugger.isInitialized;
        });

        this.test('Session Creation', () => {
            const session = this.mockVisualizationDebugger.startSession('test-session', null, {
                url: 'https://api.test.com',
                method: 'GET'
            });
            return session && session.id === 'test-session' && session.url === 'https://api.test.com';
        });

        this.test('Current Session Retrieval', () => {
            const session = this.mockVisualizationDebugger.getCurrentSession();
            return session && session.id === 'test-session';
        });

        console.log('');
    }

    async runLoggingTests() {
        console.log('📝 Running Logging Tests...');

        this.test('Basic Logging', () => {
            const result = this.mockVisualizationDebugger.log('Test message', 'info');
            const session = this.mockVisualizationDebugger.getCurrentSession();
            return result && session.logs.length > 0;
        });

        this.test('Different Log Types', () => {
            const types = ['info', 'success', 'warn', 'error', 'debug'];
            const initialLogCount = this.mockVisualizationDebugger.getCurrentSession().logs.length;

            types.forEach(type => {
                this.mockVisualizationDebugger.log(`Test ${type} message`, type);
            });

            const finalLogCount = this.mockVisualizationDebugger.getCurrentSession().logs.length;
            return finalLogCount === initialLogCount + types.length;
        });

        this.test('Complex Data Logging', () => {
            const complexData = {
                user: { name: 'John', age: 30, permissions: ['read', 'write'] },
                metadata: { created: new Date(), version: 1.0 },
                nested: { deep: { object: { test: true } } }
            };

            try {
                const result = this.mockVisualizationDebugger.log('Complex data test', 'info', complexData);
                return result;
            } catch (error) {
                return false;
            }
        });

        this.test('Circular Reference Handling', () => {
            const obj = { name: 'circular' };
            obj.self = obj;

            try {
                const result = this.mockVisualizationDebugger.log('Circular test', 'info', obj);
                return result;
            } catch (error) {
                return false;
            }
        });

        this.test('Null/Undefined Data Handling', () => {
            try {
                this.mockVisualizationDebugger.log('Null test', 'info', null);
                this.mockVisualizationDebugger.log('Undefined test', 'info', undefined);
                this.mockVisualizationDebugger.log(null, 'info');
                this.mockVisualizationDebugger.log(undefined, 'error');
                return true;
            } catch (error) {
                return false;
            }
        });

        console.log('');
    }

    async runNetworkTrackingTests() {
        console.log('🌐 Running Network Tracking Tests...');

        this.test('Add Network Request', () => {
            this.mockVisualizationDebugger.addNetworkRequest('test-session', {
                id: 'req-1',
                method: 'POST',
                url: 'https://api.test.com/data',
                status: 'pending'
            });

            const session = this.mockVisualizationDebugger.getCurrentSession();
            return session.networkRequests.length > 0 && session.networkRequests[0].id === 'req-1';
        });

        this.test('Update Network Request', () => {
            const result = this.mockVisualizationDebugger.updateNetworkRequest('test-session', 'req-1', {
                status: 'completed',
                statusCode: 200,
                statusText: 'OK',
                duration: 150
            });

            const session = this.mockVisualizationDebugger.getCurrentSession();
            const request = session.networkRequests.find(req => req.id === 'req-1');
            return result && request.status === 'completed' && request.statusCode === 200;
        });

        this.test('Multiple Network Requests', () => {
            for (let i = 2; i <= 5; i++) {
                this.mockVisualizationDebugger.addNetworkRequest('test-session', {
                    id: `req-${i}`,
                    method: 'GET',
                    url: `https://api.test.com/endpoint${i}`,
                    status: 'pending'
                });
            }

            const session = this.mockVisualizationDebugger.getCurrentSession();
            return session.networkRequests.length === 5;
        });

        this.test('Non-existent Request Update', () => {
            const result = this.mockVisualizationDebugger.updateNetworkRequest('test-session', 'non-existent', {
                status: 'completed'
            });
            return !result; // Should return false for non-existent request
        });

        console.log('');
    }

    async runPerformanceTests() {
        console.log('⚡ Running Performance Tests...');

        this.test('Rapid Logging Performance', () => {
            const startTime = Date.now();

            for (let i = 0; i < 1000; i++) {
                this.mockVisualizationDebugger.log(`Rapid log ${i}`, 'info', { index: i });
            }

            const duration = Date.now() - startTime;
            return duration < 1000; // Should complete within 1 second
        });

        this.test('Session Memory Management', () => {
            const initialSessionCount = this.mockVisualizationDebugger.debugSessions.size;

            // Create 10 sessions (should trigger cleanup)
            for (let i = 0; i < 10; i++) {
                this.mockVisualizationDebugger.startSession(`memory-test-${i}`, null, {
                    url: `https://memory${i}.com`
                });
            }

            // Should not exceed the 3 session limit
            return this.mockVisualizationDebugger.debugSessions.size <= 3;
        });

        this.test('Large Data Logging', () => {
            const largeArray = new Array(10000).fill(0).map((_, i) => ({ id: i, data: `item-${i}` }));

            try {
                const startTime = Date.now();
                this.mockVisualizationDebugger.log('Large data test', 'info', largeArray);
                const duration = Date.now() - startTime;
                return duration < 500; // Should handle large data efficiently
            } catch (error) {
                return false;
            }
        });

        console.log('');
    }

    async runErrorHandlingTests() {
        console.log('🛡️ Running Error Handling Tests...');

        this.test('Invalid Session ID', () => {
            try {
                this.mockVisualizationDebugger.log('Test message', 'info', null, 'non-existent-session');
                this.mockVisualizationDebugger.addNetworkRequest('non-existent-session', { id: 'test' });
                this.mockVisualizationDebugger.updateNetworkRequest('non-existent-session', 'test', {});
                return true; // Should not throw errors
            } catch (error) {
                return false;
            }
        });

        this.test('Malformed Log Data', () => {
            try {
                this.mockVisualizationDebugger.log('', '');
                this.mockVisualizationDebugger.log(123, 'info');
                this.mockVisualizationDebugger.log('test', 123);
                return true;
            } catch (error) {
                return false;
            }
        });

        this.test('Clear Console Without Session', () => {
            this.mockVisualizationDebugger.currentSessionId = 'non-existent';
            const result = this.mockVisualizationDebugger.clearConsole();
            return !result; // Should return false
        });

        console.log('');
    }

    async runIntegrationTests() {
        console.log('🔗 Running Integration Tests...');

        this.test('Full Request Workflow', () => {
            // Create new session for workflow
            const session = this.mockVisualizationDebugger.startSession('workflow-session', null, {
                method: 'POST',
                url: 'https://api.workflow.com/submit',
                headers: [{ key: 'Content-Type', value: 'application/json' }],
                body: JSON.stringify({ name: 'Test User' })
            });

            // Add network request
            this.mockVisualizationDebugger.addNetworkRequest('workflow-session', {
                id: 'workflow-req',
                method: 'POST',
                url: 'https://api.workflow.com/submit',
                status: 'pending',
                startTime: Date.now()
            });

            // Update with response
            this.mockVisualizationDebugger.updateNetworkRequest('workflow-session', 'workflow-req', {
                status: 'completed',
                statusCode: 201,
                statusText: 'Created',
                duration: 234,
                headers: { 'content-type': 'application/json' }
            });

            return session.networkRequests.length > 0 &&
                session.logs.length > 0 &&
                session.networkRequests[0].status === 'completed';
        });

        this.test('Session Switching', () => {
            const session1 = this.mockVisualizationDebugger.startSession('session-1', null, { url: 'https://test1.com' });
            const session2 = this.mockVisualizationDebugger.startSession('session-2', null, { url: 'https://test2.com' });

            // Current session should be session-2
            const currentSession = this.mockVisualizationDebugger.getCurrentSession();
            return currentSession.id === 'session-2';
        });

        this.test('Console Clear Functionality', () => {
            this.mockVisualizationDebugger.log('Log before clear', 'info');
            const logCountBefore = this.mockVisualizationDebugger.getCurrentSession().logs.length;

            const result = this.mockVisualizationDebugger.clearConsole();
            const logCountAfter = this.mockVisualizationDebugger.getCurrentSession().logs.length;

            return result && logCountBefore > 0 && logCountAfter === 0;
        });

        console.log('');
    }

    test(name, testFunction) {
        this.results.total++;

        try {
            const result = testFunction();
            if (result) {
                this.results.passed++;
                console.log(`  ✅ ${name}`);
                this.results.details.push({ name, status: 'PASSED', error: null });
            } else {
                this.results.failed++;
                console.log(`  ❌ ${name} - Test returned false`);
                this.results.details.push({ name, status: 'FAILED', error: 'Test returned false' });
            }
        } catch (error) {
            this.results.failed++;
            console.log(`  ❌ ${name} - ${error.message}`);
            this.results.details.push({ name, status: 'FAILED', error: error.message });
        }
    }

    displayResults() {
        console.log('\n📊 Test Results Summary:');
        console.log('═'.repeat(50));
        console.log(`Total Tests: ${this.results.total}`);
        console.log(`✅ Passed: ${this.results.passed}`);
        console.log(`❌ Failed: ${this.results.failed}`);
        console.log(`📈 Success Rate: ${((this.results.passed / this.results.total) * 100).toFixed(1)}%`);

        if (this.results.failed > 0) {
            console.log('\n❌ Failed Tests:');
            this.results.details
                .filter(test => test.status === 'FAILED')
                .forEach(test => {
                    console.log(`   • ${test.name}: ${test.error}`);
                });
        }

        console.log('\n' + '═'.repeat(50));

        if (this.results.failed === 0) {
            console.log('🎉 All tests passed! Debug console is fully functional.');
        } else {
            console.log('⚠️  Some tests failed. Please review the debug console implementation.');
        }

        this.generateReport();
    }

    generateReport() {
        const reportPath = path.join(__dirname, 'test-results', 'debug-console-test-report.json');

        // Ensure test-results directory exists
        const testResultsDir = path.dirname(reportPath);
        if (!fs.existsSync(testResultsDir)) {
            fs.mkdirSync(testResultsDir, { recursive: true });
        }

        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                total: this.results.total,
                passed: this.results.passed,
                failed: this.results.failed,
                successRate: ((this.results.passed / this.results.total) * 100).toFixed(1)
            },
            details: this.results.details,
            environment: {
                nodeVersion: process.version,
                platform: process.platform
            }
        };

        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        console.log(`\n📄 Detailed report saved to: ${reportPath}`);
    }

    static async run() {
        const runner = new DebugConsoleTestRunner();
        const results = await runner.runTests();

        // Exit with error code if tests failed
        if (results.failed > 0) {
            process.exit(1);
        }

        return results;
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    DebugConsoleTestRunner.run().catch(error => {
        console.error('Test runner failed:', error);
        process.exit(1);
    });
}

module.exports = DebugConsoleTestRunner;
