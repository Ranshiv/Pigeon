// Canvas zoom configuration
export const ZOOM_CONFIG = {
    MIN_ZOOM: 25,
    MAX_ZOOM: 200,
    DEFAULT_ZOOM: 100,
    ZOOM_STEP: 25
};

// Node types for API components
export const NODE_TYPES = {
    INFO: 'info',
    ENDPOINT: 'endpoint',
    SCHEMA: 'schema'
};

// Canvas section configurations
export const CANVAS_SECTIONS = [
    {
        id: 'api-info',
        title: 'API Information',
        nodeType: NODE_TYPES.INFO,
        icon: '📋',
        dropZoneText: 'Drop API Info component here or click + to add',
        className: 'api-info-section'
    },
    {
        id: 'endpoints',
        title: 'Endpoints',
        nodeType: NODE_TYPES.ENDPOINT,
        icon: '🌐',
        dropZoneText: 'Drop Endpoint components here to define your API routes',
        className: 'endpoints-section'
    },
    {
        id: 'schemas',
        title: 'Data Models',
        nodeType: NODE_TYPES.SCHEMA,
        icon: '🗃️',
        dropZoneText: 'Drop Schema components here to define data structures',
        className: 'schemas-section'
    }
];

// Drag and drop configuration
export const DND_CONFIG = {
    ACTIVATION_DISTANCE: 8,
    DATA_TRANSFER_TYPE: 'application/json',
    GRID_SIZE: 20,
    SNAP_THRESHOLD: 10,
    DRAG_PREVIEW_OFFSET: { x: 10, y: 10 },
    THROTTLE_DELAY: 16, // ~60fps
    TOUCH_DELAY: 150,
    DROP_ANIMATION_DURATION: 200
};

// Quick action button configurations
export const QUICK_ACTIONS = [
    {
        label: 'Add API Info',
        nodeType: NODE_TYPES.INFO,
        position: { x: 200, y: 100 }
    },
    {
        label: 'Add Endpoint',
        nodeType: NODE_TYPES.ENDPOINT,
        position: { x: 200, y: 200 }
    }
];
