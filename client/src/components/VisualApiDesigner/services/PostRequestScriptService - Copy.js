import { VisualizationEngine } from './VisualizationEngine';
import { VisualizationDebugger } from './VisualizationDebugger';

/**
 * Post-Request Script Integration Service
 * Provides pm.visualizer.set() functionality similar to Postman
 */
export class PostRequestScriptService {
    static scriptExecutor = null;
    static visualizationCallbacks = new Map();
    static scriptContext = null;

    /**
     * Initialize the post-request script service
     */
    static initialize() {
        this.createScriptExecutor();
        this.setupVisualizationAPI();
        console.log('🔧 Post-request script service initialized');
    }

    /**
     * Create secure script executor
     */
    static createScriptExecutor() {
        // Create sandboxed execution environment
        this.scriptExecutor = {
            execute: (script, context) => {
                return new Promise((resolve, reject) => {
                    try {
                        // Create sandbox context
                        const sandbox = this.createSandbox(context);

                        // Execute script in sandbox
                        const result = this.executeInSandbox(script, sandbox);
                        resolve(result);
                    } catch (error) {
                        reject(error);
                    }
                });
            }
        };
    }

    /**
     * Setup visualization API for scripts
     */
    static setupVisualizationAPI() {
        // Create pm.visualizer API
        const visualizerAPI = {
            set: (template, data, options = {}) => {
                try {
                    VisualizationDebugger.log('pm.visualizer.set() called', 'info', { template, data, options });

                    const visualization = VisualizationEngine.set(template, data, options);

                    // Store visualization for later retrieval
                    this.visualizationCallbacks.set(visualization.id, {
                        visualization,
                        timestamp: Date.now(),
                        scriptContext: this.scriptContext
                    });

                    // Trigger visualization update event
                    this.triggerVisualizationEvent('visualizationCreated', visualization);

                    return visualization;
                } catch (error) {
                    VisualizationDebugger.log(`Visualization error: ${error.message}`, 'error', error);
                    throw error;
                }
            },

            clear: () => {
                VisualizationDebugger.log('pm.visualizer.clear() called', 'info');
                this.visualizationCallbacks.clear();
                VisualizationEngine.clearAll();
                this.triggerVisualizationEvent('visualizationCleared');
            },

            get: (id) => {
                const callback = this.visualizationCallbacks.get(id);
                return callback ? callback.visualization : null;
            },

            getAll: () => {
                return Array.from(this.visualizationCallbacks.values()).map(cb => cb.visualization);
            }
        };

        // Create pm object if it doesn't exist
        if (!window.pm) {
            window.pm = {};
        }

        window.pm.visualizer = visualizerAPI;
    }

    /**
     * Execute post-request script
     */
    static async executePostRequestScript(script, response, request, environment = {}) {
        try {
            // Clear previous visualizations
            this.visualizationCallbacks.clear();

            // Create script context
            this.scriptContext = {
                response,
                request,
                environment,
                timestamp: Date.now()
            };

            // Create sandbox
            const sandbox = this.createSandbox(this.scriptContext);

            // Execute script
            const result = await this.executeInSandbox(script, sandbox);

            VisualizationDebugger.log('Post-request script executed successfully', 'info', result);

            return {
                success: true,
                result,
                visualizations: Array.from(this.visualizationCallbacks.values()).map(cb => cb.visualization),
                errors: []
            };

        } catch (error) {
            VisualizationDebugger.log(`Script execution error: ${error.message}`, 'error', error);

            return {
                success: false,
                result: null,
                visualizations: [],
                errors: [error.message]
            };
        }
    }

    /**
     * Create sandboxed execution environment
     */
    static createSandbox(context) {
        const sandbox = {
            // Response object
            pm: {
                response: {
                    json: () => context.response.data,
                    text: () => JSON.stringify(context.response.data),
                    headers: context.response.headers || {},
                    status: context.response.status,
                    responseTime: context.response.responseTime || 0,
                    responseSize: context.response.responseSize || 0
                },

                // Request object
                request: {
                    url: context.request.url,
                    method: context.request.method,
                    headers: context.request.headers || {},
                    body: context.request.body
                },

                // Environment object
                environment: {
                    get: (key) => context.environment[key],
                    set: (key, value) => {
                        context.environment[key] = value;
                        this.triggerEnvironmentEvent('variableSet', { key, value });
                    },
                    unset: (key) => {
                        delete context.environment[key];
                        this.triggerEnvironmentEvent('variableUnset', { key });
                    }
                },

                // Globals object
                globals: {
                    get: (key) => window.localStorage.getItem(`pm.globals.${key}`),
                    set: (key, value) => {
                        window.localStorage.setItem(`pm.globals.${key}`, value);
                        this.triggerEnvironmentEvent('globalSet', { key, value });
                    },
                    unset: (key) => {
                        window.localStorage.removeItem(`pm.globals.${key}`);
                        this.triggerEnvironmentEvent('globalUnset', { key });
                    }
                },

                // Visualizer API (already set up)
                visualizer: window.pm.visualizer,

                // Test utilities
                test: (description, fn) => {
                    try {
                        fn();
                        VisualizationDebugger.log(`✓ Test passed: ${description}`, 'info');
                        return true;
                    } catch (error) {
                        VisualizationDebugger.log(`✗ Test failed: ${description} - ${error.message}`, 'error');
                        return false;
                    }
                },

                // Expect utilities
                expect: (value) => ({
                    to: {
                        equal: (expected) => {
                            if (value !== expected) {
                                throw new Error(`Expected ${value} to equal ${expected}`);
                            }
                        },
                        be: {
                            ok: () => {
                                if (!value) {
                                    throw new Error(`Expected ${value} to be truthy`);
                                }
                            }
                        },
                        have: {
                            status: (statusCode) => {
                                if (context.response.status !== statusCode) {
                                    throw new Error(`Expected status ${statusCode}, got ${context.response.status}`);
                                }
                            },
                            property: (prop) => {
                                if (!(prop in value)) {
                                    throw new Error(`Expected object to have property ${prop}`);
                                }
                            }
                        }
                    }
                })
            },

            // Safe global functions
            console: {
                log: (...args) => VisualizationDebugger.log(args.join(' '), 'info'),
                warn: (...args) => VisualizationDebugger.log(args.join(' '), 'warning'),
                error: (...args) => VisualizationDebugger.log(args.join(' '), 'error')
            },

            // JSON utilities
            JSON: window.JSON,

            // Date utilities
            Date: window.Date,

            // Math utilities
            Math: window.Math,

            // String utilities
            String: window.String,

            // Number utilities
            Number: window.Number,

            // Array utilities
            Array: window.Array,

            // Object utilities
            Object: window.Object
        };

        return sandbox;
    }

    /**
     * Execute script in sandbox
     */
    static executeInSandbox(script, sandbox) {
        return new Promise((resolve, reject) => {
            try {
                // Create function with sandbox as context
                // eslint-disable-next-line no-new-func
                const scriptFunction = new Function(
                    'pm', 'console', 'JSON', 'Date', 'Math', 'String', 'Number', 'Array', 'Object',
                    script
                );

                // Execute with sandbox values
                const result = scriptFunction(
                    sandbox.pm,
                    sandbox.console,
                    sandbox.JSON,
                    sandbox.Date,
                    sandbox.Math,
                    sandbox.String,
                    sandbox.Number,
                    sandbox.Array,
                    sandbox.Object
                );

                resolve(result);
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Trigger visualization event
     */
    static triggerVisualizationEvent(eventType, data = null) {
        const event = new CustomEvent('pigeon:visualization', {
            detail: { type: eventType, data }
        });
        window.dispatchEvent(event);
    }

    /**
     * Trigger environment event
     */
    static triggerEnvironmentEvent(eventType, data = null) {
        const event = new CustomEvent('pigeon:environment', {
            detail: { type: eventType, data }
        });
        window.dispatchEvent(event);
    }

    /**
     * Get template suggestions based on response structure
     */
    static suggestTemplates(responseData) {
        const suggestions = [];

        // Analyze response structure
        if (Array.isArray(responseData)) {
            suggestions.push({
                name: 'Data Table',
                description: 'Display array data in a table format',
                template: `
                    <table style="width:100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: #f5f5f5;">
                                {{#each headers}}
                                <th style="padding: 8px; border: 1px solid #ddd;">{{this}}</th>
                                {{/each}}
                            </tr>
                        </thead>
                        <tbody>
                            {{#each items}}
                            <tr>
                                {{#each ../headers}}
                                <td style="padding: 8px; border: 1px solid #ddd;">{{lookup ../this this}}</td>
                                {{/each}}
                            </tr>
                            {{/each}}
                        </tbody>
                    </table>
                `
            });
        }

        // Check for numeric data
        const numericKeys = this.findNumericKeys(responseData);
        if (numericKeys.length > 0) {
            suggestions.push({
                name: 'Bar Chart',
                description: 'Visualize numeric data as a bar chart',
                template: `
                    <canvas id="chart-{{timestamp}}" width="400" height="200"></canvas>
                    <script>
                        // Chart.js implementation would go here
                    </script>
                `
            });
        }

        // Check for status/metrics
        if (responseData.status || responseData.metrics) {
            suggestions.push({
                name: 'Status Dashboard',
                description: 'Display status and metrics information',
                template: `
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
                        {{#each metrics}}
                        <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; text-align: center;">
                            <div style="font-size: 24px; font-weight: bold; color: #333;">{{this.value}}</div>
                            <div style="color: #666;">{{this.label}}</div>
                        </div>
                        {{/each}}
                    </div>
                `
            });
        }

        return suggestions;
    }

    /**
     * Find numeric keys in data
     */
    static findNumericKeys(data) {
        const numericKeys = [];

        if (Array.isArray(data) && data.length > 0) {
            const firstItem = data[0];
            Object.keys(firstItem).forEach(key => {
                if (typeof firstItem[key] === 'number') {
                    numericKeys.push(key);
                }
            });
        } else if (typeof data === 'object') {
            Object.keys(data).forEach(key => {
                if (typeof data[key] === 'number') {
                    numericKeys.push(key);
                }
            });
        }

        return numericKeys;
    }

    /**
     * Create pre-built script templates
     */
    static getScriptTemplates() {
        return {
            'basic-test': {
                name: 'Basic Response Test',
                description: 'Test response status and basic structure',
                script: `
// Test response status
pm.test("Status code is 200", function () {
    pm.response.to.have.status(200);
});

// Test response time
pm.test("Response time is less than 200ms", function () {
    pm.expect(pm.response.responseTime).to.be.below(200);
});

// Test response structure
pm.test("Response has required fields", function () {
    const jsonData = pm.response.json();
    pm.expect(jsonData).to.have.property('data');
});
                `
            },

            'data-visualization': {
                name: 'Data Visualization',
                description: 'Create visualizations from response data',
                script: `
// Get response data
const responseData = pm.response.json();

// Create a simple table visualization
pm.visualizer.set(\`
    <style>
        .response-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .response-table th, .response-table td { 
            border: 1px solid #ddd; padding: 8px; text-align: left; 
        }
        .response-table th { background-color: #f2f2f2; }
    </style>
    <h3>Response Data</h3>
    <table class="response-table">
        <thead>
            <tr>
                <th>Key</th>
                <th>Value</th>
            </tr>
        </thead>
        <tbody>
            {{#each data}}
            <tr>
                <td>{{@key}}</td>
                <td>{{this}}</td>
            </tr>
            {{/each}}
        </tbody>
    </table>
\`, responseData);
                `
            },

            'metrics-dashboard': {
                name: 'Metrics Dashboard',
                description: 'Create a metrics dashboard from response data',
                script: `
// Get response data
const responseData = pm.response.json();

// Create metrics dashboard
pm.visualizer.set(\`
    <style>
        .metrics-dashboard { padding: 20px; background: #f8f9fa; border-radius: 8px; }
        .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
        .metric-card { background: white; padding: 16px; border-radius: 8px; text-align: center; }
        .metric-value { font-size: 24px; font-weight: bold; color: #333; }
        .metric-label { color: #666; margin-top: 8px; }
    </style>
    <div class="metrics-dashboard">
        <h3>API Metrics</h3>
        <div class="metrics-grid">
            <div class="metric-card">
                <div class="metric-value">{{status}}</div>
                <div class="metric-label">Status Code</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">{{responseTime}}ms</div>
                <div class="metric-label">Response Time</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">{{responseSize}}</div>
                <div class="metric-label">Response Size</div>
            </div>
        </div>
    </div>
\`, {
    status: pm.response.status,
    responseTime: pm.response.responseTime,
    responseSize: pm.response.responseSize
});
                `
            }
        };
    }

    /**
     * Validate script syntax
     */
    static validateScript(script) {
        try {
            // eslint-disable-next-line no-new-func
            new Function(script);
            return { valid: true, errors: [] };
        } catch (error) {
            return { valid: false, errors: [error.message] };
        }
    }

    /**
     * Get script execution history
     */
    static getExecutionHistory() {
        return Array.from(this.visualizationCallbacks.values()).map(callback => ({
            id: callback.visualization.id,
            timestamp: callback.timestamp,
            scriptContext: callback.scriptContext
        }));
    }

    /**
     * Clean up service
     */
    static cleanup() {
        this.visualizationCallbacks.clear();
        this.scriptContext = null;

        // Remove pm object from window
        if (window.pm && window.pm.visualizer) {
            delete window.pm.visualizer;
        }
    }
}

export default PostRequestScriptService;
