import React, { useState } from 'react';
import { VisualizationEngine } from '../services/VisualizationEngine';
import TemplateLibraryManager from '../services/TemplateLibraryManager';
import ChartRenderer from './ChartRenderer';

/**
 * VisualizationShowcase - Demonstrates all visualization features
 * This component showcases the implemented visualization capabilities
 */
const VisualizationShowcase = () => {
    const [activeDemo, setActiveDemo] = useState('charts');
    const [visualization, setVisualization] = useState(null);

    // Sample data for demonstrations
    const sampleData = {
        analytics: {
            users: 15420,
            revenue: 125430,
            orders: 890,
            conversion: 3.8
        },
        usersList: [
            { name: 'John Doe', age: 30, score: 85, department: 'Engineering' },
            { name: 'Jane Smith', age: 25, score: 92, department: 'Design' },
            { name: 'Bob Johnson', age: 35, score: 78, department: 'Marketing' },
            { name: 'Alice Brown', age: 28, score: 95, department: 'Engineering' },
            { name: 'Charlie Wilson', age: 42, score: 88, department: 'Sales' }
        ],
        apiStatus: {
            status: 200,
            responseTime: 245,
            size: 2048,
            timestamp: new Date().toISOString()
        }
    };

    const demonstrations = {
        charts: {
            title: 'Chart Generation',
            demos: [
                {
                    name: 'Bar Chart',
                    action: () => {
                        const chartData = sampleData.usersList.map(user => ({
                            label: user.name,
                            value: user.score
                        }));

                        const viz = VisualizationEngine.generateChart('bar', chartData, {
                            title: 'User Scores',
                            backgroundColor: '#014C75'
                        });
                        setVisualization(viz);
                    }
                },
                {
                    name: 'Pie Chart',
                    action: () => {
                        const viz = VisualizationEngine.generateChart('pie', sampleData.analytics, {
                            title: 'Analytics Overview'
                        });
                        setVisualization(viz);
                    }
                },
                {
                    name: 'Line Chart',
                    action: () => {
                        const timeData = Array.from({ length: 7 }, (_, i) => ({
                            label: `Day ${i + 1}`,
                            value: 100 + Math.random() * 200
                        }));

                        const viz = VisualizationEngine.generateChart('line', timeData, {
                            title: 'Weekly Trend'
                        });
                        setVisualization(viz);
                    }
                },
                {
                    name: 'Doughnut Chart',
                    action: () => {
                        const departments = {};
                        sampleData.usersList.forEach(user => {
                            departments[user.department] = (departments[user.department] || 0) + 1;
                        });

                        const viz = VisualizationEngine.generateChart('doughnut', departments, {
                            title: 'Department Distribution'
                        });
                        setVisualization(viz);
                    }
                }
            ]
        },
        tables: {
            title: 'Table Visualizations',
            demos: [
                {
                    name: 'Data Table',
                    action: () => {
                        const viz = VisualizationEngine.createTable(sampleData.usersList, {
                            title: 'User Data Table',
                            showHeaders: true
                        });
                        setVisualization(viz);
                    }
                },
                {
                    name: 'Modern Table',
                    action: () => {
                        const template = TemplateLibraryManager.getTemplate('modern-table');
                        if (template) {
                            const viz = VisualizationEngine.set(template.template, {
                                title: 'Modern User Table',
                                data: sampleData.usersList,
                                headers: Object.keys(sampleData.usersList[0])
                            });
                            setVisualization(viz);
                        }
                    }
                }
            ]
        },
        metrics: {
            title: 'Metrics Dashboards',
            demos: [
                {
                    name: 'Metrics Cards',
                    action: () => {
                        const viz = VisualizationEngine.createMetrics(sampleData.analytics, {
                            title: 'Key Performance Metrics'
                        });
                        setVisualization(viz);
                    }
                },
                {
                    name: 'API Status',
                    action: () => {
                        const template = TemplateLibraryManager.getTemplate('api-status');
                        if (template) {
                            const viz = VisualizationEngine.set(template.template, {
                                overallStatus: 'healthy',
                                overallStatusText: 'All Systems Operational',
                                ...sampleData.apiStatus,
                                uptime: 99.9,
                                responseTimePercent: (sampleData.apiStatus.responseTime / 1000) * 100,
                                services: [
                                    { name: 'Database', status: 'healthy', responseTime: 12 },
                                    { name: 'API Gateway', status: 'healthy', responseTime: 45 },
                                    { name: 'Cache', status: 'degraded', responseTime: 156 }
                                ]
                            });
                            setVisualization(viz);
                        }
                    }
                }
            ]
        },
        templates: {
            title: 'Template System',
            demos: [
                {
                    name: 'Custom Template',
                    action: () => {
                        const customTemplate = `
                            <div style="padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 10px;">
                                <h2 style="margin: 0 0 16px 0;">🚀 {{title}}</h2>
                                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
                                    {{#each metrics}}
                                    <div style="background: rgba(255,255,255,0.1); padding: 16px; border-radius: 8px; text-align: center;">
                                        <div style="font-size: 24px; font-weight: bold;">{{this.value}}</div>
                                        <div style="opacity: 0.8;">{{this.label}}</div>
                                    </div>
                                    {{/each}}
                                </div>
                            </div>
                        `;

                        const formattedMetrics = Object.entries(sampleData.analytics).map(([key, value]) => ({
                            label: key.charAt(0).toUpperCase() + key.slice(1),
                            value: typeof value === 'number' ? value.toLocaleString() : value
                        }));

                        const viz = VisualizationEngine.set(customTemplate, {
                            title: 'Custom Analytics Dashboard',
                            metrics: formattedMetrics
                        });
                        setVisualization(viz);
                    }
                },
                {
                    name: 'Template Library',
                    action: () => {
                        const templates = TemplateLibraryManager.getAllTemplates();
                        const libraryHtml = `
                            <div style="padding: 20px;">
                                <h3>Available Templates (${templates.length})</h3>
                                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px;">
                                    ${templates.map(template => `
                                        <div style="border: 1px solid #ddd; padding: 16px; border-radius: 8px;">
                                            <h4 style="margin: 0 0 8px 0; color: #333;">${template.name}</h4>
                                            <p style="margin: 0 0 8px 0; color: #666; font-size: 14px;">${template.description}</p>
                                            <span style="background: #f0f0f0; padding: 4px 8px; border-radius: 4px; font-size: 12px;">${template.category}</span>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        `;

                        setVisualization({
                            id: 'template-library',
                            rendered: libraryHtml,
                            name: 'Template Library',
                            type: 'custom'
                        });
                    }
                }
            ]
        }
    };

    const renderVisualization = () => {
        if (!visualization) {
            return (
                <div style={{
                    padding: '60px 20px',
                    textAlign: 'center',
                    color: '#666',
                    background: '#f8f9fa',
                    borderRadius: '8px'
                }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
                    <h3>Select a demonstration</h3>
                    <p>Choose from the options above to see the visualization features in action</p>
                </div>
            );
        }

        // If it's a chart visualization, render using ChartRenderer
        if (visualization.type === 'chart' && visualization.data && visualization.data.chartConfig) {
            const chartConfig = visualization.data.chartConfig;
            return (
                <div style={{ padding: '20px', background: 'white', borderRadius: '8px' }}>
                    <ChartRenderer
                        type={chartConfig.type}
                        data={chartConfig.data}
                        options={chartConfig.options}
                        width={600}
                        height={400}
                    />
                </div>
            );
        }

        return (
            <div
                style={{ background: 'white', borderRadius: '8px', overflow: 'hidden' }}
                dangerouslySetInnerHTML={{ __html: visualization.rendered }}
            />
        );
    };

    return (
        <div style={{ padding: '20px', background: '#f8f9fa', minHeight: '100vh' }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                <header style={{ marginBottom: '32px', textAlign: 'center' }}>
                    <h1 style={{ color: '#333', marginBottom: '8px' }}>🎨 Visualization Showcase</h1>
                    <p style={{ color: '#666', fontSize: '18px' }}>
                        Demonstration of all implemented visualization features
                    </p>
                </header>

                <div style={{ display: 'flex', gap: '24px' }}>
                    {/* Navigation */}
                    <div style={{ width: '250px' }}>
                        <div style={{ background: 'white', borderRadius: '8px', padding: '16px' }}>
                            <h3 style={{ margin: '0 0 16px 0', color: '#333' }}>Features</h3>
                            {Object.entries(demonstrations).map(([key, demo]) => (
                                <button
                                    key={key}
                                    onClick={() => setActiveDemo(key)}
                                    style={{
                                        display: 'block',
                                        width: '100%',
                                        padding: '12px 16px',
                                        margin: '0 0 8px 0',
                                        border: '1px solid #ddd',
                                        borderRadius: '6px',
                                        background: activeDemo === key ? '#014C75' : 'white',
                                        color: activeDemo === key ? 'white' : '#333',
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                        fontSize: '14px',
                                        fontWeight: '500'
                                    }}
                                >
                                    {demo.title}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1 }}>
                        {/* Demo Buttons */}
                        <div style={{
                            background: 'white',
                            borderRadius: '8px',
                            padding: '20px',
                            marginBottom: '24px'
                        }}>
                            <h3 style={{ margin: '0 0 16px 0', color: '#333' }}>
                                {demonstrations[activeDemo].title}
                            </h3>
                            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                {demonstrations[activeDemo].demos.map((demo, index) => (
                                    <button
                                        key={index}
                                        onClick={demo.action}
                                        style={{
                                            padding: '10px 16px',
                                            border: '1px solid #014C75',
                                            borderRadius: '6px',
                                            background: 'white',
                                            color: '#014C75',
                                            cursor: 'pointer',
                                            fontSize: '14px',
                                            fontWeight: '500',
                                            transition: 'all 0.2s'
                                        }}
                                        onMouseOver={(e) => {
                                            e.target.style.background = '#014C75';
                                            e.target.style.color = 'white';
                                        }}
                                        onMouseOut={(e) => {
                                            e.target.style.background = 'white';
                                            e.target.style.color = '#014C75';
                                        }}
                                    >
                                        {demo.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Visualization Display */}
                        {renderVisualization()}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VisualizationShowcase;
