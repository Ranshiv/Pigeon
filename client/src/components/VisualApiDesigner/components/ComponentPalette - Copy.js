import React, { useState, useCallback, useRef } from 'react';
import { FiSearch, FiGlobe, FiFolderPlus, FiDatabase, FiSettings, FiLock, FiInfo, FiTag } from 'react-icons/fi';
import { createDragImage, cleanupDragOperation } from '../utils/dragDropUtils';
import { DND_CONFIG } from '../constants/designCanvasConstants';

/**
 * ComponentPalette - Left sidebar for draggable API components
 * Follows Clean Code principles:
 * - SRP: Only handles component palette display and search
 * - Small functions with clear names
 * - Extracted configuration to constants
 */
const ComponentPalette = ({ onDragStart }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [isDragging, setIsDragging] = useState(false);
    const dragImageRef = useRef(null);

    const componentCategories = [
        {
            name: 'ENDPOINTS',
            components: [
                {
                    type: 'endpoint',
                    name: 'HTTP Endpoint',
                    description: 'Define REST API endpoint',
                    icon: <FiGlobe />
                },
                {
                    type: 'resource',
                    name: 'Resource',
                    description: 'Group related endpoints',
                    icon: <FiFolderPlus />
                }
            ]
        },
        {
            name: 'DATA MODELS',
            components: [
                {
                    type: 'schema',
                    name: 'Schema',
                    description: 'Define data structure',
                    icon: <FiDatabase />
                },
                {
                    type: 'parameter',
                    name: 'Parameter',
                    description: 'Request parameter',
                    icon: <FiSettings />
                }
            ]
        },
        {
            name: 'SECURITY',
            components: [
                {
                    type: 'security',
                    name: 'Security Scheme',
                    description: 'Authentication method',
                    icon: <FiLock />
                }
            ]
        },
        {
            name: 'DOCUMENTATION',
            components: [
                {
                    type: 'info',
                    name: 'API Info',
                    description: 'API metadata',
                    icon: <FiInfo />
                },
                {
                    type: 'tag',
                    name: 'Tag',
                    description: 'Organize endpoints',
                    icon: <FiTag />
                }
            ]
        }
    ];

    // Extracted filtering logic for better readability
    const filterComponentsBySearch = (categories, searchTerm) => {
        return categories.map(category => ({
            ...category,
            components: category.components.filter(component =>
                component.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                component.description.toLowerCase().includes(searchTerm.toLowerCase())
            )
        })).filter(category => category.components.length > 0);
    };

    const filteredCategories = filterComponentsBySearch(componentCategories, searchTerm);

    // Enhanced drag handling with visual feedback and accessibility
    const handleDragStart = useCallback((e, component) => {
        try {
            const dragData = {
                type: component.type,
                name: component.name,
                description: component.description
                // Note: We don't include the icon in drag data as it's a React element
            };

            // Set drag data
            e.dataTransfer.setData(DND_CONFIG.DATA_TRANSFER_TYPE, JSON.stringify(dragData));
            e.dataTransfer.effectAllowed = 'copy';

            // Create and set custom drag image for better visual feedback
            const dragImage = createDragImage(component);
            dragImageRef.current = dragImage;

            // Set custom drag image with offset
            e.dataTransfer.setDragImage(
                dragImage,
                DND_CONFIG.DRAG_PREVIEW_OFFSET.x,
                DND_CONFIG.DRAG_PREVIEW_OFFSET.y
            );

            // Update drag state for visual feedback
            setIsDragging(true);

            // Add visual feedback to body
            document.body.style.cursor = 'grabbing';
            document.body.classList.add('dragging-component');

            // Call parent drag start handler
            if (onDragStart) {
                onDragStart(dragData);
            }

        } catch (error) {
            console.error('Error starting drag operation:', error);
        }
    }, [onDragStart]);

    // Handle drag end to clean up visual feedback
    const handleDragEnd = useCallback((e) => {
        setIsDragging(false);
        cleanupDragOperation();
        document.body.classList.remove('dragging-component');
    }, []);

    // Enhanced touch support for mobile devices
    const handleTouchStart = useCallback((e, component) => {
        const touch = e.touches[0];
        const target = e.currentTarget;

        // Add visual feedback for touch
        target.classList.add('touch-dragging');

        // Store touch data for potential drag operation
        target.dataset.touchComponent = JSON.stringify(component);
        target.dataset.touchStartX = touch.clientX;
        target.dataset.touchStartY = touch.clientY;

        // Start touch drag delay
        setTimeout(() => {
            if (target.classList.contains('touch-dragging')) {
                // Trigger haptic feedback if available
                if (navigator.vibrate) {
                    navigator.vibrate(50);
                }
            }
        }, DND_CONFIG.TOUCH_DELAY);
    }, []);

    const handleTouchEnd = useCallback((e) => {
        e.currentTarget.classList.remove('touch-dragging');
    }, []);

    // Extracted keyboard handling for accessibility
    const handleKeyDown = (e, component) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            console.log(`Selected component: ${component.type}`);
            // Could trigger selection or other action
        }
    };

    return (
        <div className="component-palette">
            <div className="palette-header">
                <h3>
                    <FiDatabase />
                    Component Palette
                </h3>
                <div className="search-container">
                    <FiSearch className="search-icon" />
                    <input
                        type="text"
                        className="palette-search"
                        placeholder="Search components..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="palette-categories">
                {filteredCategories.map((category, index) => (
                    <div key={category.name} className="palette-category">
                        <h4 className="category-header">{category.name}</h4>
                        <div className="category-components">
                            {category.components.map((component) => (
                                <div
                                    key={component.type}
                                    className={`component-item ${isDragging ? 'dragging' : ''}`}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, component)}
                                    onDragEnd={handleDragEnd}
                                    onTouchStart={(e) => handleTouchStart(e, component)}
                                    onTouchEnd={handleTouchEnd}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => handleKeyDown(e, component)}
                                    aria-label={`Drag ${component.name} to canvas`}
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
