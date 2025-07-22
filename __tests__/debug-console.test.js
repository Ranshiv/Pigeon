/**
 * Comprehensive Debug Console Test Suite
 * Tests all aspects of the VisualizationDebugger functionality
 */

const { JSDOM } = require('jsdom');

// Set up DOM environment for testing
const dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`, {
    url: 'http://localhost:3000',
    pretendToBeVisual: true,
    resources: 'usable'
});

global.window = dom.window;
global.document = dom.window.document;
global.Element = dom.window.Element;
global.HTMLElement = dom.window.HTMLElement;

describe('VisualizationDebugger Console Tests', () => {
    let visualDebugger;
    let mockContainer;

    beforeEach(() => {
        // Reset the debugger state
        const { VisualizationDebugger } = require('../client/src/components/VisualApiDesigner/services/VisualizationDebugger');
        visualDebugger = VisualizationDebugger;

        // Clear any existing state
        visualDebugger.debugSessions.clear();
        visualDebugger.currentSessionId = null;
        visualDebugger.isInitialized = false;
        visualDebugger._isUpdatingDOM = false;
        visualDebugger._pendingLogs = [];

        // Create mock DOM elements
        document.body.innerHTML = '';
        mockContainer = document.createElement('div');
        mockContainer.id = 'visualization-debugger-container';

        const debugContent = document.createElement('div');
        debugContent.className = 'debug-content';

        const placeholder = document.createElement('div');
        placeholder.className = 'modern-debug-placeholder';

        debugContent.appendChild(placeholder);
        mockContainer.appendChild(debugContent);
        document.body.appendChild(mockContainer);
    });

    afterEach(() => {
        // Clean up
        document.body.innerHTML = '';
        if (visualDebugger.debugPanel) {
            visualDebugger.debugPanel = null;
        }
    });

    describe('Initialization Tests', () => {
        test('should initialize debugger successfully', () => {
            expect(debugger.isEnabled).toBe(false);
        expect(debugger.isInitialized).toBe(false);

    debugger.initialize();

    expect(debugger.isEnabled).toBe(true);
expect(debugger.isInitialized).toBe(true);
        });

test('should setup keyboard shortcuts without conflicts', () => {
    const eventListenerSpy = jest.spyOn(document, 'addEventListener');

    debugger.initialize();

    expect(eventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

    // Test that F12 is not intercepted (should allow browser dev tools)
    const keydownEvent = new KeyboardEvent('keydown', { key: 'F12' });
    const preventDefaultSpy = jest.spyOn(keydownEvent, 'preventDefault');

    document.dispatchEvent(keydownEvent);

    expect(preventDefaultSpy).not.toHaveBeenCalled();
});

test('should recognize existing debug container', () => {
    const hidePopupSpy = jest.spyOn(debugger, 'hidePopupPanel');

debugger.initialize();

expect(hidePopupSpy).toHaveBeenCalled();
        });
    });

describe('Session Management Tests', () => {
    test('should create debug session successfully', () => {
        const sessionData = {
            method: 'GET',
            url: 'https://api.example.com/users',
            headers: [{ key: 'Authorization', value: 'Bearer token' }]
        };

        const session = debugger.startSession('test-session-1', mockContainer, sessionData);

        expect(session).toBeDefined();
        expect(session.id).toBe('test-session-1');
        expect(session.url).toBe('https://api.example.com/users');
        expect(session.method).toBe('GET');
        expect(debugger.currentSessionId).toBe('test-session-1');
    expect(debugger.debugSessions.has('test-session-1')).toBe(true);
        });

test('should manage multiple sessions and cleanup old ones', () => {
    // Create 5 sessions (more than the 3 session limit)
    for (let i = 1; i <= 5; i++) {
        debugger.startSession(`session-${i}`, mockContainer, { url: `https://api${i}.com` });
    }

    // Should only keep the 3 most recent sessions
    expect(debugger.debugSessions.size).toBe(3);
expect(debugger.debugSessions.has('session-1')).toBe(false);
expect(debugger.debugSessions.has('session-2')).toBe(false);
expect(debugger.debugSessions.has('session-3')).toBe(true);
expect(debugger.debugSessions.has('session-4')).toBe(true);
expect(debugger.debugSessions.has('session-5')).toBe(true);
        });
    });

describe('Logging Functionality Tests', () => {
    beforeEach(() => {
        debugger.startSession('test-session', mockContainer, { url: 'https://test.com' });
    });

    test('should log messages with different types', () => {
        const logTypes = ['info', 'error', 'warn', 'success', 'debug'];

        logTypes.forEach(type => {
            debugger.log(`Test ${type} message`, type, { data: 'test' });
        });

        const session = debugger.getCurrentSession();
        expect(session.logs).toHaveLength(logTypes.length + 3); // +3 for initial session logs

        session.logs.slice(-5).forEach((log, index) => {
            expect(log.type).toBe(logTypes[index]);
            expect(log.message).toBe(`Test ${logTypes[index]} message`);
        });
    });

    test('should handle complex data objects safely', () => {
        const complexData = {
            nested: { object: { with: 'deep nesting' } },
            array: [1, 2, 3],
            nullValue: null,
            undefinedValue: undefined
        };

        // Should not throw errors with complex data
        expect(() => {
            debugger.log('Complex data test', 'info', complexData);
        }).not.toThrow();

        const session = debugger.getCurrentSession();
        const lastLog = session.logs[session.logs.length - 1];
        expect(lastLog.data).toBeDefined();
    });

    test('should handle circular references safely', () => {
        const circularObj = { name: 'test' };
        circularObj.self = circularObj;

        expect(() => {
            debugger.log('Circular reference test', 'info', circularObj);
        }).not.toThrow();
    });
});

describe('DOM Manipulation Tests', () => {
    beforeEach(() => {
        debugger.startSession('test-session', mockContainer, { url: 'https://test.com' });
    });

    test('should create console output area when needed', () => {
        debugger.showDebugPanel();

        const consoleOutput = document.getElementById('console-output');
        expect(consoleOutput).toBeTruthy();
        expect(consoleOutput.style.background).toBe('rgb(15, 23, 42)'); // #0f172a
    });

    test('should display log entries in DOM safely', () => {
        debugger.log('Test log entry', 'info');

        const consoleOutput = document.getElementById('console-output');
        expect(consoleOutput).toBeTruthy();

        const logEntries = consoleOutput.querySelectorAll('.log-entry');
        expect(logEntries.length).toBeGreaterThan(0);
    });

    test('should prevent DOM update conflicts', () => {
        // Simulate rapid logging that could cause DOM conflicts
        debugger._isUpdatingDOM = true;

        debugger.log('Should be queued', 'info');

        expect(debugger._pendingLogs.length).toBe(1);

    debugger._isUpdatingDOM = false;
    debugger.log('Should process immediately', 'info');

    expect(debugger._pendingLogs.length).toBe(0);
        });

test('should auto-scroll console to latest logs', () => {
    // Add multiple log entries
    for (let i = 0; i < 10; i++) {
        debugger.log(`Log entry ${i}`, 'info');
    }

    const consoleOutput = document.getElementById('console-output');
    expect(consoleOutput.scrollTop).toBe(consoleOutput.scrollHeight);
});
    });

describe('Network Request Tracking Tests', () => {
    beforeEach(() => {
        debugger.startSession('test-session', mockContainer, { url: 'https://test.com' });
    });

    test('should add network requests to session', () => {
        const requestData = {
            id: 'req-123',
            method: 'POST',
            url: 'https://api.example.com/data',
            status: 'pending'
        };

        debugger.addNetworkRequest('test-session', requestData);

        const session = debugger.getCurrentSession();
        expect(session.networkRequests).toHaveLength(1);
        expect(session.networkRequests[0].id).toBe('req-123');
    });

    test('should update network requests with response data', () => {
        // Add initial request
        debugger.addNetworkRequest('test-session', {
            id: 'req-123',
            method: 'GET',
            url: 'https://api.example.com/data'
        });

        // Update with response data
        debugger.updateNetworkRequest('test-session', 'req-123', {
            status: 'completed',
            statusCode: 200,
            statusText: 'OK',
            duration: 250
        });

        const session = debugger.getCurrentSession();
        const request = session.networkRequests[0];
        expect(request.status).toBe('completed');
        expect(request.statusCode).toBe(200);
        expect(request.duration).toBe(250);
    });
});

describe('Console Control Tests', () => {
    beforeEach(() => {
        debugger.startSession('test-session', mockContainer, { url: 'https://test.com' });
    });

    test('should clear console successfully', () => {
        // Add some logs
        debugger.log('Log 1', 'info');
        debugger.log('Log 2', 'error');

        let session = debugger.getCurrentSession();
        expect(session.logs.length).toBeGreaterThan(2);

        debugger.clearConsole();

        session = debugger.getCurrentSession();
        expect(session.logs).toHaveLength(0);

        const consoleOutput = document.getElementById('console-output');
        expect(consoleOutput.innerHTML).toContain('Console Cleared');
    });

    test('should handle keyboard shortcuts correctly', () => {
        const scrollIntoViewSpy = jest.spyOn(mockContainer, 'scrollIntoView');

        // Test Ctrl+Shift+D shortcut
        const keyEvent = new KeyboardEvent('keydown', {
            key: 'D',
            ctrlKey: true,
            shiftKey: true
        });

        document.dispatchEvent(keyEvent);

        expect(scrollIntoViewSpy).toHaveBeenCalled();
    });
});

describe('Performance and Safety Tests', () => {
    test('should not create infinite loops in performance monitoring', () => {
        const startTime = Date.now();

        debugger.startSession('perf-test', mockContainer, { url: 'https://test.com' });

        // Wait a bit to see if any infinite loops occur
        return new Promise((resolve) => {
            setTimeout(() => {
                const elapsed = Date.now() - startTime;
                expect(elapsed).toBeLessThan(1000); // Should complete quickly
                resolve();
            }, 100);
        });
    });

    test('should handle rapid consecutive logs without freezing', () => {
        const startTime = Date.now();

        debugger.startSession('rapid-test', mockContainer, { url: 'https://test.com' });

        // Add 100 rapid logs
        for (let i = 0; i < 100; i++) {
            debugger.log(`Rapid log ${i}`, 'info', { index: i });
        }

        const elapsed = Date.now() - startTime;
        expect(elapsed).toBeLessThan(1000); // Should handle rapidly

        const session = debugger.getCurrentSession();
        expect(session.logs.length).toBeGreaterThan(100);
    });

    test('should not leak memory with session management', () => {
        const initialSessionCount = debugger.debugSessions.size;

        // Create and destroy multiple sessions
        for (let i = 0; i < 10; i++) {
            debugger.startSession(`temp-${i}`, mockContainer, { url: `https://temp${i}.com` });
        }

        // Should not exceed the session limit (3)
        expect(debugger.debugSessions.size).toBeLessThanOrEqual(3);
});
    });

describe('Error Handling Tests', () => {
    test('should handle missing DOM elements gracefully', () => {
        // Remove the container
        document.body.innerHTML = '';

        expect(() => {
            debugger.startSession('missing-dom', null, { url: 'https://test.com' });
            debugger.log('Test with missing DOM', 'error');
        }).not.toThrow();
    });

    test('should handle invalid session IDs gracefully', () => {
        expect(() => {
            debugger.log('Invalid session test', 'info', null, 'non-existent-session');
            debugger.addNetworkRequest('non-existent-session', { id: 'req-1' });
            debugger.updateNetworkRequest('non-existent-session', 'req-1', { status: 'completed' });
        }).not.toThrow();
    });

    test('should handle malformed log data gracefully', () => {
        debugger.startSession('error-test', mockContainer, { url: 'https://test.com' });

        expect(() => {
            debugger.log(null, 'info');
            debugger.log(undefined, 'error');
            debugger.log('', 'warn');
            debugger.log('Test', null);
            debugger.log('Test', undefined);
        }).not.toThrow();
    });
});

describe('Integration Tests', () => {
    test('should integrate with RequestForm debug button flow', () => {
        // Simulate the RequestForm debug button click
        const sessionData = {
            method: 'POST',
            url: 'https://api.example.com/users',
            headers: [{ key: 'Content-Type', value: 'application/json' }],
            body: JSON.stringify({ name: 'Test User' }),
            bodyType: 'raw'
        };

        debugger.showDebugPanel();
        const session = debugger.startSession('request-form-test', mockContainer, sessionData);

        expect(session).toBeDefined();
        expect(debugger.currentSessionId).toBe('request-form-test');

    const consoleOutput = document.getElementById('console-output');
    expect(consoleOutput).toBeTruthy();

    // Should have initial session logs
    expect(session.logs.length).toBeGreaterThan(0);
});

test('should work with actual request flow simulation', async () => {
    const session = debugger.startSession('full-flow-test', mockContainer, {
        method: 'GET',
        url: 'https://jsonplaceholder.typicode.com/users/1'
    });

    // Simulate request start
    debugger.addNetworkRequest('full-flow-test', {
        id: 'req-full-test',
        method: 'GET',
        url: 'https://jsonplaceholder.typicode.com/users/1',
        status: 'pending',
        startTime: Date.now()
    });

    // Simulate request completion
    debugger.updateNetworkRequest('full-flow-test', 'req-full-test', {
        status: 'completed',
        statusCode: 200,
        statusText: 'OK',
        duration: 150,
        headers: { 'content-type': 'application/json' }
    });

    expect(session.networkRequests).toHaveLength(1);
    expect(session.networkRequests[0].status).toBe('completed');
    expect(session.logs.length).toBeGreaterThan(3); // Initial + network logs
});
    });
});

module.exports = {
    runDebugConsoleTests: () => {
        console.log('🧪 Running Debug Console Comprehensive Tests...');
        // This would be run by Jest in a real environment
        return true;
    }
};
