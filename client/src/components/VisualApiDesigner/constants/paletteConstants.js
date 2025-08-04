// Component palette configuration constants
export const PALETTE_CATEGORIES = [
    {
        name: 'ENDPOINTS',
        components: [
            {
                type: 'endpoint',
                name: 'HTTP Endpoint',
                description: 'Define REST API endpoint',
                iconName: 'FiGlobe'
            },
            {
                type: 'resource',
                name: 'Resource',
                description: 'Group related endpoints',
                iconName: 'FiFolderPlus'
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
                iconName: 'FiDatabase'
            },
            {
                type: 'parameter',
                name: 'Parameter',
                description: 'Request parameter',
                iconName: 'FiSettings'
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
                iconName: 'FiLock'
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
                iconName: 'FiInfo'
            },
            {
                type: 'tag',
                name: 'Tag',
                description: 'Organize endpoints',
                iconName: 'FiTag'
            }
        ]
    }
];

// Search configuration
export const SEARCH_CONFIG = {
    PLACEHOLDER: 'Search components...',
    NO_RESULTS_MESSAGE: 'No components match your search.'
};
