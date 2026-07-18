import Handlebars from 'handlebars';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    LineElement,
    PointElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    LineElement,
    PointElement,
    ArcElement,
    Title,
    Tooltip,
    Legend
);

/**
 * Visualization Engine for API Response Data
 * Provides template-based visualization similar to Postman's Visualizer
 */
const MAX_CHART_POINTS = 1000;

export class VisualizationEngine {
    static templates = new Map();

    /**
     * Set visualization using template and data
     * @param {string} template - HTML template with Handlebars syntax
     * @param {Object} data - Data to be visualized
     * @param {Object} options - Visualization options
     * @returns {Object} Rendered visualization
     */
    static set(template, data, options = {}) {
        try {
            // Compile Handlebars template
            const compiledTemplate = Handlebars.compile(template);

            // Render with data
            const rendered = compiledTemplate(data);

            // Create visualization object
            const visualization = {
                id: `viz-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
                template: template,
                data: data,
                rendered: rendered,
                options: options,
                type: this.detectVisualizationType(template),
                timestamp: new Date().toISOString()
            };

            // Store template for reuse
            this.templates.set(visualization.id, visualization);

            return visualization;
        } catch (error) {
            console.error('Visualization Engine Error:', error);
            throw new Error(`Visualization failed: ${error.message}`);
        }
    }

    /**
     * Generate chart from data automatically
     * @param {string} type - Chart type (bar, line, pie, table, etc.)
     * @param {Object} data - Data for chart
     * @param {Object} config - Chart configuration
     * @returns {Object} Chart visualization
     */
    static generateChart(type, data, config = {}) {
        const chartConfig = this.buildChartConfig(type, data, config);
        const placeholder = '<div class="chart-visualization"></div>';

        return this.set(placeholder, { chartConfig, rawData: data }, { ...config, type: 'chart' });
    }

    /**
     * Auto-suggest chart type based on data structure
     * @param {Object} data - Data to analyze
     * @returns {Array} Array of suggested chart types with confidence scores
     */
    static suggestChartTypes(data) {
        const suggestions = [];

        if (Array.isArray(data)) {
            if (data.length > 0 && typeof data[0] === 'object') {
                const keys = Object.keys(data[0]);
                const hasNumericValues = keys.some(key =>
                    data.every(item => typeof item[key] === 'number')
                );

                if (hasNumericValues) {
                    suggestions.push(
                        { type: 'bar', confidence: 0.9, reason: 'Numeric data with categories' },
                        { type: 'line', confidence: 0.8, reason: 'Good for trend analysis' },
                        { type: 'pie', confidence: 0.6, reason: 'Shows proportions' }
                    );
                }

                suggestions.push(
                    { type: 'table', confidence: 0.95, reason: 'Always suitable for structured data' }
                );
            }
        } else if (typeof data === 'object') {
            const values = Object.values(data);
            const hasNumericValues = values.every(v => typeof v === 'number');

            if (hasNumericValues) {
                suggestions.push(
                    { type: 'pie', confidence: 0.9, reason: 'Perfect for key-value numeric data' },
                    { type: 'bar', confidence: 0.8, reason: 'Good for comparing values' },
                    { type: 'doughnut', confidence: 0.7, reason: 'Modern alternative to pie chart' }
                );
            }
        }

        return suggestions.sort((a, b) => b.confidence - a.confidence);
    }

    /**
     * Generate multiple visualizations from response data
     * @param {Object} responseData - API response data
     * @param {Object} options - Generation options
     * @returns {Array} Array of generated visualizations
     */
    static generateFromResponse(responseData, options = {}) {
        const visualizations = [];

        try {
            // Handle array data
            if (Array.isArray(responseData)) {
                const tableViz = this.createTable(responseData, {
                    title: options.title || 'Response Data',
                    maxRows: options.maxRows || 100
                });
                visualizations.push({
                    ...tableViz,
                    name: 'Data Table',
                    autoGenerated: true
                });

                // Generate charts for numeric data
                if (responseData.length > 0 && typeof responseData[0] === 'object') {
                    const numericColumns = this.findNumericColumns(responseData);

                    numericColumns.forEach(column => {
                        const chartData = responseData.map(item => ({
                            label: item.name || item.id || item.title || `Item ${responseData.indexOf(item) + 1}`,
                            value: item[column]
                        }));

                        const barChart = this.generateChart('bar', chartData, {
                            title: `${column} Distribution`,
                            xLabel: 'Items',
                            yLabel: column
                        });

                        visualizations.push({
                            ...barChart,
                            name: `${column} Bar Chart`,
                            autoGenerated: true
                        });
                    });
                }
            }

            // Handle object data
            else if (typeof responseData === 'object') {
                // Create metrics if numeric values exist
                const numericMetrics = this.extractNumericMetrics(responseData);
                if (Object.keys(numericMetrics).length > 0) {
                    const metricsViz = this.createMetrics(numericMetrics);
                    visualizations.push({
                        ...metricsViz,
                        name: 'Key Metrics',
                        autoGenerated: true
                    });

                    // Create pie chart for numeric metrics
                    const pieChart = this.generateChart('pie', numericMetrics, {
                        title: 'Metrics Distribution'
                    });
                    visualizations.push({
                        ...pieChart,
                        name: 'Metrics Pie Chart',
                        autoGenerated: true
                    });
                }

                // Handle nested arrays
                Object.entries(responseData).forEach(([key, value]) => {
                    if (Array.isArray(value) && value.length > 0) {
                        const tableViz = this.createTable(value, {
                            title: `${key} Data`
                        });
                        visualizations.push({
                            ...tableViz,
                            name: `${key} Table`,
                            autoGenerated: true
                        });
                    }
                });
            }

        } catch (error) {
            console.error('Error generating visualizations:', error);
            throw new Error(`Failed to generate visualizations: ${error.message}`);
        }

        return visualizations;
    }

    /**
     * Find numeric columns in array data
     * @param {Array} data - Array of objects
     * @returns {Array} Array of column names with numeric data
     */
    static findNumericColumns(data) {
        if (!Array.isArray(data) || data.length === 0) return [];

        const firstItem = data[0];
        if (typeof firstItem !== 'object') return [];

        return Object.keys(firstItem).filter(key =>
            data.every(item => typeof item[key] === 'number' && !isNaN(item[key]))
        );
    }

    /**
     * Extract numeric metrics from object
     * @param {Object} data - Object data
     * @returns {Object} Object with only numeric values
     */
    static extractNumericMetrics(data) {
        const metrics = {};

        Object.entries(data).forEach(([key, value]) => {
            if (typeof value === 'number' && !isNaN(value)) {
                metrics[key] = value;
            }
        });

        return metrics;
    }

    /**
     * Create table visualization
     * @param {Array} data - Array of objects to display as table
     * @param {Object} options - Table options
     * @returns {Object} Table visualization
     */
    static createTable(data, options = {}) {
        const template = `
            <div class="visualization-table">
                <table class="data-table">
                    {{#if @root.options.showHeaders}}
                    <thead>
                        <tr>
                            {{#each @root.headers}}
                            <th>{{this}}</th>
                            {{/each}}
                        </tr>
                    </thead>
                    {{/if}}
                    <tbody>
                        {{#each items}}
                        <tr>
                            {{#each ../headers}}
                            <td>{{lookup ../this this}}</td>
                            {{/each}}
                        </tr>
                        {{/each}}
                    </tbody>
                </table>
            </div>
        `;

        const headers = data.length > 0 ? Object.keys(data[0]) : [];

        return this.set(template, {
            items: data,
            headers: headers,
            options: { showHeaders: true, ...options }
        });
    }

    /**
     * Create metrics cards visualization
     * @param {Object} metrics - Key-value pairs of metrics
     * @param {Object} options - Display options
     * @returns {Object} Metrics visualization
     */
    static createMetrics(metrics, options = {}) {
        const template = `
            <div class="ts-kpi-grid">
                {{#each metrics}}
                <div class="ts-kpi">
                    <div class="ts-kpi-label">{{this.label}}</div>
                    <div class="ts-kpi-value">{{this.value}}</div>
                    {{#if this.change}}
                    <div class="ts-kpi-change {{this.changeType}}">
                        {{this.change}}
                    </div>
                    {{/if}}
                </div>
                {{/each}}
            </div>
        `;

        const formattedMetrics = Object.entries(metrics).map(([key, value]) => ({
            label: key,
            value: typeof value === 'object' ? value.value : value,
            change: typeof value === 'object' ? value.change : null,
            changeType: typeof value === 'object' && value.change ?
                (value.change.startsWith('+') ? 'positive' : 'negative') : null
        }));

        return this.set(template, { metrics: formattedMetrics }, options);
    }

    /**
     * Build Chart.js configuration
     * @param {string} type - Chart type
     * @param {Object} data - Chart data
     * @param {Object} config - User configuration
     * @returns {Object} Chart.js config
     */
    static buildChartConfig(type, data, config) {
        const baseConfig = {
            type: type,
            data: this.formatChartData(type, data),
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: config.title || 'API Data Visualization'
                    },
                    legend: {
                        display: type !== 'table'
                    }
                },
                ...config.options
            }
        };

        // Type-specific configurations
        switch (type) {
            case 'bar':
            case 'line':
                baseConfig.options.scales = {
                    y: {
                        beginAtZero: true
                    }
                };
                break;
            case 'pie':
            case 'doughnut':
                baseConfig.options.plugins.legend.position = 'bottom';
                break;
            default:
                // Use base configuration for other chart types
                break;
        }

        return baseConfig;
    }

    /**
     * Format data for Chart.js
     * @param {string} type - Chart type
     * @param {Object} data - Raw data
     * @returns {Object} Formatted chart data
     */
    static formatChartData(type, data) {
        if (Array.isArray(data)) {
            const clamped = data.slice(0, MAX_CHART_POINTS);

            // Array of objects
            if (clamped.length > 0 && typeof clamped[0] === 'object') {
                const keys = Object.keys(clamped[0]);
                const labelKey = keys[0];
                const valueKey = keys[1] || keys[0];

                return {
                    labels: clamped.map(item => item[labelKey]),
                    datasets: [{
                        label: valueKey,
                        data: clamped.map(item => item[valueKey]),
                        backgroundColor: this.generateColors(clamped.length),
                        borderColor: this.generateColors(clamped.length, 0.8),
                        borderWidth: 1
                    }]
                };
            }

            // Array of primitives
            return {
                labels: clamped.map((_, index) => `Item ${index + 1}`),
                datasets: [{
                    label: 'Values',
                    data: clamped,
                    backgroundColor: this.generateColors(clamped.length),
                    borderColor: this.generateColors(clamped.length, 0.8),
                    borderWidth: 1
                }]
            };
        }

        // Object with key-value pairs
        if (typeof data === 'object' && data !== null) {
            const entries = Object.entries(data).slice(0, MAX_CHART_POINTS);
            return {
                labels: entries.map(([key]) => key),
                datasets: [{
                    label: 'Values',
                    data: entries.map(([, value]) => value),
                    backgroundColor: this.generateColors(entries.length),
                    borderColor: this.generateColors(entries.length, 0.8),
                    borderWidth: 1
                }]
            };
        }

        return { labels: [], datasets: [] };
    }

    /**
     * Generate colors for charts
     * @param {number} count - Number of colors needed
     * @param {number} alpha - Alpha transparency
     * @returns {Array} Array of color strings
     */
    static generateColors(count, alpha = 0.6) {
        const colors = [
            '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
            '#FF9F40', '#C9CBCF', '#22C55E', '#F59E0B', '#EF4444'
        ];

        return Array.from({ length: count }, (_, i) => {
            const color = colors[i % colors.length];
            if (alpha < 1) {
                // Convert hex to rgba
                const r = parseInt(color.slice(1, 3), 16);
                const g = parseInt(color.slice(3, 5), 16);
                const b = parseInt(color.slice(5, 7), 16);
                return `rgba(${r}, ${g}, ${b}, ${alpha})`;
            }
            return color;
        });
    }

    /**
     * Detect visualization type from template
     * @param {string} template - HTML template
     * @returns {string} Visualization type
     */
    static detectVisualizationType(template) {
        if (template.includes('<canvas')) return 'chart';
        if (template.includes('<table')) return 'table';
        if (template.includes('ts-kpi')) return 'metrics';
        if (template.includes('{{#each')) return 'list';
        return 'custom';
    }

    /**
     * Get all stored visualizations
     * @returns {Array} Array of visualizations
     */
    static getVisualizations() {
        return Array.from(this.templates.values());
    }

    /**
     * Clear all visualizations
     */
    static clearAll() {
        this.templates.clear();
    }

    /**
     * Remove specific visualization
     * @param {string} id - Visualization ID
     */
    static remove(id) {
        this.templates.delete(id);
    }

    /**
     * Pre-built visualization templates
     */
    static getPrebuiltTemplates() {
        return {
            'response-table': {
                name: 'Response Data Table',
                description: 'Display API response as a formatted table',
                template: `
                    <div class="response-table-container">
                        <h3>{{title}}</h3>
                        {{#if data}}
                        <table class="response-table">
                            <thead>
                                <tr>
                                    {{#each headers}}
                                    <th>{{this}}</th>
                                    {{/each}}
                                </tr>
                            </thead>
                            <tbody>
                                {{#each data}}
                                <tr>
                                    {{#each ../headers}}
                                    <td>{{lookup ../this this}}</td>
                                    {{/each}}
                                </tr>
                                {{/each}}
                            </tbody>
                        </table>
                        {{else}}
                        <p>No data available</p>
                        {{/if}}
                    </div>
                `
            },
            'status-metrics': {
                name: 'API Status Metrics',
                description: 'Show response status, time, and size metrics',
                template: `
                    <div class="ts-kpi-grid">
                        <div class="ts-kpi status-{{statusClass status}}">
                            <div class="ts-kpi-label">Status</div>
                            <div class="ts-kpi-value">{{status}}</div>
                        </div>
                        <div class="ts-kpi">
                            <div class="ts-kpi-label">Response Time</div>
                            <div class="ts-kpi-value">{{responseTime}}ms</div>
                        </div>
                        <div class="ts-kpi">
                            <div class="ts-kpi-label">Size</div>
                            <div class="ts-kpi-value">{{size}}</div>
                        </div>
                    </div>
                `
            },
            'json-tree': {
                name: 'JSON Tree View',
                description: 'Display JSON response in an expandable tree format',
                template: `
                    <div class="json-tree">
                        <pre class="json-content">{{json response}}</pre>
                    </div>
                `
            }
        };
    }
}

// Register Handlebars helpers
Handlebars.registerHelper('json', function (context) {
    return JSON.stringify(context, null, 2);
});

Handlebars.registerHelper('formatBytes', function (bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
});

Handlebars.registerHelper('statusClass', function (status) {
    if (status >= 200 && status < 300) return 'success';
    if (status >= 300 && status < 400) return 'warning';
    if (status >= 400) return 'error';
    return 'default';
});

Handlebars.registerHelper('statusText', function (status) {
    const statusTexts = {
        200: 'OK',
        201: 'Created',
        204: 'No Content',
        301: 'Moved Permanently',
        302: 'Found',
        400: 'Bad Request',
        401: 'Unauthorized',
        403: 'Forbidden',
        404: 'Not Found',
        500: 'Internal Server Error',
        502: 'Bad Gateway',
        503: 'Service Unavailable'
    };
    return statusTexts[status] || 'Unknown';
});

Handlebars.registerHelper('formatTimestamp', function (timestamp) {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleString();
});

export default VisualizationEngine;
