/**
 * Template Library Manager
 * Manages prebuilt visualization templates and external library integrations
 */
export class TemplateLibraryManager {
    static templates = new Map();
    static externalLibraries = new Map();

    /**
     * Initialize default templates
     */
    static initialize() {
        this.loadDefaultTemplates();
        this.registerExternalLibraries();
    }

    /**
     * Load default visualization templates
     */
    static loadDefaultTemplates() {
        const defaultTemplates = {
            // Data Table Templates
            'modern-table': {
                id: 'modern-table',
                name: 'Modern Data Table',
                category: 'table',
                description: 'Clean, modern table with sorting and filtering',
                preview: '/api/templates/preview/modern-table.png',
                template: `
                    <div class="modern-table-container">
                        <div class="table-header">
                            <h3>{{title}}</h3>
                            <div class="table-controls">
                                <input type="search" placeholder="Search..." class="table-search">
                                <button class="btn btn-export">Export</button>
                            </div>
                        </div>
                        <div class="table-wrapper">
                            <table class="modern-table">
                                <thead>
                                    <tr>
                                        {{#each headers}}
                                        <th class="sortable" data-column="{{this}}">
                                            {{this}}
                                            <span class="sort-icon">↕</span>
                                        </th>
                                        {{/each}}
                                    </tr>
                                </thead>
                                <tbody>
                                    {{#each data}}
                                    <tr>
                                        {{#each ../headers}}
                                        <td data-label="{{this}}">{{lookup ../this this}}</td>
                                        {{/each}}
                                    </tr>
                                    {{/each}}
                                </tbody>
                            </table>
                        </div>
                        <div class="table-footer">
                            <span class="record-count">{{data.length}} records</span>
                        </div>
                    </div>
                `,
                styles: `
                    .modern-table-container { border-radius: 8px; overflow: hidden; }
                    .table-header { display: flex; justify-content: space-between; padding: 16px; background: #f8f9fa; }
                    .modern-table { width: 100%; border-collapse: collapse; }
                    .modern-table th, .modern-table td { padding: 12px; text-align: left; border-bottom: 1px solid #dee2e6; }
                    .modern-table th { background: #f8f9fa; font-weight: 600; }
                    .modern-table tr:hover { background: #f8f9fa; }
                    .sortable { cursor: pointer; user-select: none; }
                    .sort-icon { margin-left: 8px; opacity: 0.5; }
                `
            },

            // Chart Templates  
            'analytics-dashboard': {
                id: 'analytics-dashboard',
                name: 'Analytics Dashboard',
                category: 'chart',
                description: 'Comprehensive analytics dashboard with multiple chart types',
                template: `
                    <div class="analytics-dashboard">
                        <div class="dashboard-header">
                            <h2>{{title}}</h2>
                            <div class="date-range">{{dateRange}}</div>
                        </div>
                        
                        <div class="ts-kpi-grid">
                            {{#each overview}}
                            <div class="ts-kpi">
                                <div class="ts-kpi-label">{{this.label}}</div>
                                <div class="ts-kpi-value">{{this.value}}</div>
                                <div class="ts-kpi-change {{this.changeType}}">{{this.change}}</div>
                            </div>
                            {{/each}}
                        </div>
                        
                        <div class="charts-grid">
                            <div class="chart-card">
                                <h4>Daily Trends</h4>
                                <canvas id="trend-chart-{{timestamp}}"></canvas>
                            </div>
                            <div class="chart-card">
                                <h4>Traffic Sources</h4>
                                <canvas id="pie-chart-{{timestamp}}"></canvas>
                            </div>
                        </div>
                    </div>
                `
            },

            // Status Templates
            'api-status': {
                id: 'api-status',
                name: 'API Status Monitor',
                category: 'status',
                description: 'Real-time API status and performance monitoring',
                template: `
                    <div class="api-status-monitor">
                        <div class="status-header">
                            <h3>API Status</h3>
                            <div class="last-updated">Last updated: {{formatTimestamp timestamp}}</div>
                        </div>
                        
                        <div class="overall-status status-{{overallStatus}}">
                            <div class="status-indicator"></div>
                            <span class="status-text">{{overallStatusText}}</span>
                        </div>
                        
                        <div class="ts-kpi-grid">
                            <div class="ts-kpi">
                                <div class="ts-kpi-label">Response Time</div>
                                <div class="ts-kpi-value">{{responseTime}}ms</div>
                            </div>
                            <div class="ts-kpi">
                                <div class="ts-kpi-label">Uptime</div>
                                <div class="ts-kpi-value">{{uptime}}%</div>
                            </div>
                        </div>
                        
                        <div class="services-status">
                            {{#each services}}
                            <div class="service-item status-{{this.status}}">
                                <div class="service-name">{{this.name}}</div>
                                <div class="service-status">{{this.status}}</div>
                                <div class="service-response-time">{{this.responseTime}}ms</div>
                            </div>
                            {{/each}}
                        </div>
                    </div>
                `
            },

            // Heat Map Template
            'heatmap-calendar': {
                id: 'heatmap-calendar',
                name: 'Activity Heatmap',
                category: 'chart',
                description: 'Calendar-style heatmap for time-series data',
                template: `
                    <div class="heatmap-container">
                        <h3>{{title}}</h3>
                        <div class="heatmap-legend">
                            <span>Less</span>
                            <div class="legend-scale">
                                {{#each legendColors}}
                                <div class="legend-color" style="background: {{this}}"></div>
                                {{/each}}
                            </div>
                            <span>More</span>
                        </div>
                        <div class="heatmap-grid">
                            {{#each data}}
                            <div class="heatmap-cell" 
                                 style="background: {{this.color}}" 
                                 title="{{this.date}}: {{this.value}}"
                                 data-value="{{this.value}}">
                            </div>
                            {{/each}}
                        </div>
                    </div>
                `
            },

            // JSON Tree Template
            'json-explorer': {
                id: 'json-explorer',
                name: 'JSON Explorer',
                category: 'data',
                description: 'Interactive JSON tree viewer with collapsible nodes',
                template: `
                    <div class="json-explorer">
                        <div class="json-header">
                            <h3>{{title}}</h3>
                        </div>
                        <pre class="json-content">
                            {{json data}}
                        </pre>
                    </div>
                `
            }
        };

        Object.values(defaultTemplates).forEach(template => {
            this.templates.set(template.id, template);
        });
    }

    /**
     * Register external visualization libraries
     */
    static registerExternalLibraries() {
        const libraries = {
            'd3': {
                name: 'D3.js',
                version: '7.8.5',
                cdnUrl: 'https://d3js.org/d3.v7.min.js',
                description: 'Advanced data visualization library',
                capabilities: ['custom-charts', 'interactive-maps', 'force-diagrams', 'tree-diagrams']
            },
            'plotly': {
                name: 'Plotly.js',
                version: '2.26.0',
                cdnUrl: 'https://cdn.plot.ly/plotly-2.26.0.min.js',
                description: 'Scientific and statistical charting',
                capabilities: ['3d-charts', 'scientific-plots', 'statistical-charts', 'geographic-maps']
            },
            'echarts': {
                name: 'Apache ECharts',
                version: '5.4.3',
                cdnUrl: 'https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js',
                description: 'Professional data visualization library',
                capabilities: ['business-charts', 'geographic-visualization', 'real-time-data']
            },
            'cytoscape': {
                name: 'Cytoscape.js',
                version: '3.26.0',
                cdnUrl: 'https://unpkg.com/cytoscape@3.26.0/dist/cytoscape.min.js',
                description: 'Graph theory and network visualization',
                capabilities: ['network-graphs', 'node-relationships', 'graph-algorithms']
            }
        };

        Object.entries(libraries).forEach(([key, library]) => {
            this.externalLibraries.set(key, library);
        });
    }

    /**
     * Get template by ID
     */
    static getTemplate(id) {
        return this.templates.get(id);
    }

    /**
     * Get all templates by category
     */
    static getTemplatesByCategory(category) {
        return Array.from(this.templates.values())
            .filter(template => template.category === category);
    }

    /**
     * Get all available templates
     */
    static getAllTemplates() {
        return Array.from(this.templates.values());
    }

    /**
     * Add custom template
     */
    static addTemplate(template) {
        if (!template.id) {
            template.id = `custom-${Date.now()}`;
        }
        this.templates.set(template.id, template);
        return template.id;
    }

    /**
     * Get external library info
     */
    static getExternalLibrary(name) {
        return this.externalLibraries.get(name);
    }

    /**
     * Load external library dynamically
     */
    static async loadExternalLibrary(name) {
        const library = this.externalLibraries.get(name);
        if (!library) {
            throw new Error(`Library ${name} not found`);
        }

        // Check if already loaded
        if (window[library.name] || window[name]) {
            return;
        }

        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = library.cdnUrl;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    /**
     * Generate template suggestions based on data structure
     */
    static suggestTemplates(data) {
        const suggestions = [];

        if (Array.isArray(data)) {
            suggestions.push(
                { template: 'modern-table', confidence: 0.9, reason: 'Array data fits table format' }
            );

            if (data.length > 0 && typeof data[0] === 'object') {
                const hasNumericData = Object.values(data[0]).some(v => typeof v === 'number');
                if (hasNumericData) {
                    suggestions.push(
                        { template: 'analytics-dashboard', confidence: 0.7, reason: 'Numeric data suitable for charts' }
                    );
                }
            }
        }

        if (typeof data === 'object' && !Array.isArray(data)) {
            suggestions.push(
                { template: 'json-explorer', confidence: 0.8, reason: 'Object data fits JSON tree view' }
            );

            if (data.status || data.health) {
                suggestions.push(
                    { template: 'api-status', confidence: 0.9, reason: 'Status data detected' }
                );
            }
        }

        return suggestions.sort((a, b) => b.confidence - a.confidence);
    }
}

// Initialize the template library
TemplateLibraryManager.initialize();

export default TemplateLibraryManager;
