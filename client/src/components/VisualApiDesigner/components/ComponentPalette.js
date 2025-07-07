import React, { useState } from 'react';

const ComponentPalette = ({ onDragStart }) => {
    const [searchTerm, setSearchTerm] = useState('');

    const componentCategories = [
        {
            name: 'Endpoints',
            components: [
                {
                    type: 'endpoint',
                    name: 'HTTP Endpoint',
                    description: 'Define REST API endpoint',
                    icon: '🌐'
                },
                {
                    type: 'resource',
                    name: 'Resource',
                    description: 'Group related endpoints',
                    icon: '📁'
                }
            ]
        },
        {
            name: 'Data Models',
            components: [
                {
                    type: 'schema',
                    name: 'Schema',
                    description: 'Define data structure',
                    icon: '📋'
                },
                {
                    type: 'parameter',
                    name: 'Parameter',
                    description: 'Request parameter',
                    icon: '🔧'
                }
            ]
        },
        {
            name: 'Security',
            components: [
                {
                    type: 'security',
                    name: 'Security Scheme',
                    description: 'Authentication method',
                    icon: '🔐'
                }
            ]
        },
        {
            name: 'Documentation',
            components: [
                {
                    type: 'info',
                    name: 'API Info',
                    description: 'API metadata',
                    icon: 'ℹ️'
                },
                {
                    type: 'tag',
                    name: 'Tag',
                    description: 'Organize endpoints',
                    icon: '🏷️'
                }
            ]
        }
    ];

    const filteredCategories = componentCategories.map(category => ({
        ...category,
        components: category.components.filter(component =>
            component.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            component.description.toLowerCase().includes(searchTerm.toLowerCase())
        )
    })).filter(category => category.components.length > 0);

    const handleDragStart = (e, componentType) => {
        e.dataTransfer.setData('text/plain', componentType);
        e.dataTransfer.effectAllowed = 'copy';
        if (onDragStart) {
            onDragStart(componentType);
        }
    };

    return (
        <div className="component-palette">
            <div className="palette-header">
                <h3>Component Palette</h3>
                <input
                    type="text"
                    className="palette-search"
                    placeholder="Search components..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            <div className="palette-categories">
                {filteredCategories.map((category) => (
                    <div key={category.name} className="palette-category">
                        <h4>{category.name}</h4>
                        {category.components.map((component) => (
                            <div
                                key={component.type}
                                className="component-item"
                                draggable
                                onDragStart={(e) => handleDragStart(e, component.type)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        // Handle keyboard interaction for accessibility
                                        console.log(`Selected component: ${component.type}`);
                                    }
                                }}
                            >
                                <div className="component-icon">
                                    {component.icon}
                                </div>
                                <div className="component-details">
                                    <div className="component-name">{component.name}</div>
                                    <div className="component-description">{component.description}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                ))}
            </div>

            {filteredCategories.length === 0 && (
                <div className="no-results">
                    <p>No components match your search.</p>
                </div>
            )}
        </div>
    );
};

export default ComponentPalette;
