import { NetworkFlowService } from './NetworkFlowService';

/**
 * Authentication Visualization Service
 * Provides interactive visualization of authentication flows
 */
export class AuthVisualizationService {
    static authFlows = new Map();
    static supportedFlows = {
        OAUTH2: 'oauth2',
        OPENID_CONNECT: 'openid_connect',
        API_KEY: 'api_key',
        BASIC_AUTH: 'basic_auth',
        BEARER_TOKEN: 'bearer_token',
        JWT: 'jwt',
        CUSTOM: 'custom'
    };

    /**
     * Initialize authentication visualization service
     */
    static initialize() {
        this.loadAuthFlowTemplates();
        console.log('🔐 Authentication Visualization Service initialized');
    }

    /**
     * Create authentication flow visualization
     */
    static createAuthFlowVisualization(containerId, authConfig, options = {}) {
        const flowType = authConfig.type || this.supportedFlows.OAUTH2;
        const flowTemplate = this.getAuthFlowTemplate(flowType);

        if (!flowTemplate) {
            throw new Error(`Unsupported authentication flow: ${flowType}`);
        }

        // Generate nodes and edges based on auth flow
        const { nodes, edges } = this.generateAuthFlowData(flowTemplate, authConfig);

        // Create visualization using NetworkFlowService
        const cy = NetworkFlowService.createApiFlowDiagram(containerId, nodes, edges, {
            ...options,
            layout: {
                name: 'dagre',
                directed: true,
                spacingFactor: 1.5,
                nodeDimensionsIncludeLabels: true,
                rankDir: 'TB'
            }
        });

        // Add authentication-specific interactions
        this.addAuthFlowInteractions(cy, authConfig);

        // Store flow instance
        this.authFlows.set(containerId, {
            instance: cy,
            config: authConfig,
            type: flowType
        });

        return cy;
    }

    /**
     * Interpolate labels with config values
     */
    static interpolateLabel(label, config) {
        if (!label) return label;

        return label.replace(/\{\{(\w+)\}\}/g, (match, key) => {
            return config[key] || match;
        });
    }

    /**
     * Add authentication-specific interactions
     */
    static addAuthFlowInteractions(cy, config) {
        // Highlight authentication steps
        cy.on('tap', 'node', function (evt) {
            const node = evt.target;
            const nodeType = node.data('type');

            if (nodeType === 'auth_step') {
                cy.elements().removeClass('highlighted');

                // Highlight the authentication path
                const authPath = cy.elements().bfs({
                    root: node,
                    directed: true
                });

                authPath.path.addClass('highlighted');
            }
        });

        // Show flow details on edge click
        cy.on('tap', 'edge', function (evt) {
            const edge = evt.target;
            const edgeData = edge.data();

            if (edgeData.type === 'auth_request') {
                console.log('Authentication request:', edgeData);
            }
        });

        // Animate flow progression
        this.animateAuthFlow(cy, config);
    }

    /**
     * Animate authentication flow
     */
    static animateAuthFlow(cy, config) {
        const animationDuration = 2000;
        const steps = cy.nodes('[type="auth_step"]');

        let currentStep = 0;

        const animateStep = () => {
            if (currentStep >= steps.length) {
                currentStep = 0;
            }

            // Reset all nodes
            cy.nodes().removeClass('active');

            // Activate current step
            steps[currentStep].addClass('active');

            // Find outgoing edges and animate them
            const outgoingEdges = steps[currentStep].outgoers('edge');
            outgoingEdges.addClass('active');

            setTimeout(() => {
                outgoingEdges.removeClass('active');
                currentStep++;
                animateStep();
            }, animationDuration);
        };

        // Start animation
        setTimeout(animateStep, 1000);
    }

    /**
     * Load authentication flow templates
     */
    static loadAuthFlowTemplates() {
        // OAuth 2.0 Authorization Code Flow
        this.authFlows.set(this.supportedFlows.OAUTH2, {
            name: 'OAuth 2.0 Authorization Code Flow',
            description: 'Standard OAuth 2.0 authorization code flow with PKCE',
            steps: [
                { id: 'client', name: 'Client Application', type: 'client' },
                { id: 'auth_server', name: 'Authorization Server', type: 'auth_server' },
                { id: 'resource_server', name: 'Resource Server', type: 'resource_server' },
                { id: 'user', name: 'User', type: 'user' }
            ],
            flows: [
                { from: 'client', to: 'auth_server', label: '1. Authorization Request', type: 'redirect' },
                { from: 'auth_server', to: 'user', label: '2. User Authentication', type: 'interaction' },
                { from: 'user', to: 'auth_server', label: '3. User Consent', type: 'interaction' },
                { from: 'auth_server', to: 'client', label: '4. Authorization Code', type: 'redirect' },
                { from: 'client', to: 'auth_server', label: '5. Access Token Request', type: 'api' },
                { from: 'auth_server', to: 'client', label: '6. Access Token Response', type: 'api' },
                { from: 'client', to: 'resource_server', label: '7. Protected Resource Request', type: 'api' },
                { from: 'resource_server', to: 'client', label: '8. Protected Resource Response', type: 'api' }
            ]
        });

        // OpenID Connect Flow
        this.authFlows.set(this.supportedFlows.OPENID_CONNECT, {
            name: 'OpenID Connect Flow',
            description: 'OpenID Connect authentication flow with ID token',
            steps: [
                { id: 'client', name: 'Client Application', type: 'client' },
                { id: 'openid_provider', name: 'OpenID Provider', type: 'openid_provider' },
                { id: 'user', name: 'User', type: 'user' }
            ],
            flows: [
                { from: 'client', to: 'openid_provider', label: '1. Authentication Request', type: 'redirect' },
                { from: 'openid_provider', to: 'user', label: '2. User Authentication', type: 'interaction' },
                { from: 'user', to: 'openid_provider', label: '3. User Consent', type: 'interaction' },
                { from: 'openid_provider', to: 'client', label: '4. Authorization Code', type: 'redirect' },
                { from: 'client', to: 'openid_provider', label: '5. Token Request', type: 'api' },
                { from: 'openid_provider', to: 'client', label: '6. ID Token + Access Token', type: 'api' },
                { from: 'client', to: 'openid_provider', label: '7. UserInfo Request', type: 'api' },
                { from: 'openid_provider', to: 'client', label: '8. UserInfo Response', type: 'api' }
            ]
        });

        // API Key Flow
        this.authFlows.set(this.supportedFlows.API_KEY, {
            name: 'API Key Authentication',
            description: 'Simple API key authentication flow',
            steps: [
                { id: 'client', name: 'Client Application', type: 'client' },
                { id: 'api_server', name: 'API Server', type: 'api_server' },
                { id: 'auth_service', name: 'Authentication Service', type: 'auth_service' }
            ],
            flows: [
                { from: 'client', to: 'api_server', label: '1. API Request + API Key', type: 'api' },
                { from: 'api_server', to: 'auth_service', label: '2. Validate API Key', type: 'internal' },
                { from: 'auth_service', to: 'api_server', label: '3. Validation Result', type: 'internal' },
                { from: 'api_server', to: 'client', label: '4. API Response', type: 'api' }
            ]
        });

        // Basic Auth Flow
        this.authFlows.set(this.supportedFlows.BASIC_AUTH, {
            name: 'Basic Authentication',
            description: 'HTTP Basic Authentication flow',
            steps: [
                { id: 'client', name: 'Client Application', type: 'client' },
                { id: 'api_server', name: 'API Server', type: 'api_server' },
                { id: 'user_store', name: 'User Store', type: 'database' }
            ],
            flows: [
                { from: 'client', to: 'api_server', label: '1. Request + Basic Auth Header', type: 'api' },
                { from: 'api_server', to: 'user_store', label: '2. Validate Credentials', type: 'internal' },
                { from: 'user_store', to: 'api_server', label: '3. Validation Result', type: 'internal' },
                { from: 'api_server', to: 'client', label: '4. API Response', type: 'api' }
            ]
        });

        // JWT Flow
        this.authFlows.set(this.supportedFlows.JWT, {
            name: 'JWT Authentication',
            description: 'JSON Web Token authentication flow',
            steps: [
                { id: 'client', name: 'Client Application', type: 'client' },
                { id: 'auth_server', name: 'Authentication Server', type: 'auth_server' },
                { id: 'api_server', name: 'API Server', type: 'api_server' }
            ],
            flows: [
                { from: 'client', to: 'auth_server', label: '1. Login Request', type: 'api' },
                { from: 'auth_server', to: 'client', label: '2. JWT Token', type: 'api' },
                { from: 'client', to: 'api_server', label: '3. API Request + JWT', type: 'api' },
                { from: 'api_server', to: 'auth_server', label: '4. Validate JWT', type: 'internal' },
                { from: 'auth_server', to: 'api_server', label: '5. Validation Result', type: 'internal' },
                { from: 'api_server', to: 'client', label: '6. API Response', type: 'api' }
            ]
        });
    }

    /**
     * Get authentication flow template
     */
    static getAuthFlowTemplate(flowType) {
        return this.authFlows.get(flowType);
    }

    /**
     * Generate authentication flow data
     */
    static generateAuthFlowData(flowTemplate, authConfig) {
        const nodes = flowTemplate.steps.map(step => ({
            id: step.id,
            label: step.name,
            type: step.type,
            data: {
                ...step,
                config: authConfig[step.id] || {}
            }
        }));

        const edges = flowTemplate.flows.map((flow, index) => ({
            id: `flow-${index}`,
            source: flow.from,
            target: flow.to,
            label: flow.label,
            type: flow.type,
            data: flow
        }));

        return { nodes, edges };
    }

    /**
     * Create interactive authentication flow
     */
    static createInteractiveAuthFlow(containerId, flowType, authConfig, options = {}) {
        const flowTemplate = this.getAuthFlowTemplate(flowType);
        if (!flowTemplate) {
            throw new Error(`Unsupported authentication flow: ${flowType}`);
        }

        const { nodes, edges } = this.generateAuthFlowData(flowTemplate, authConfig);

        // Create the visualization
        const cy = NetworkFlowService.createApiFlowDiagram(containerId, nodes, edges, {
            ...options,
            style: this.getAuthFlowStyles(),
            layout: {
                name: 'dagre',
                directed: true,
                spacingFactor: 1.5,
                nodeDimensionsIncludeLabels: true,
                rankDir: 'TB',
                animate: true,
                animationDuration: 1000
            }
        });

        // Add interactive features
        this.addInteractiveFeatures(cy, flowType, authConfig);

        return cy;
    }

    /**
     * Get authentication flow styles
     */
    static getAuthFlowStyles() {
        return [
            {
                selector: 'node',
                style: {
                    'background-color': '#f8f9fa',
                    'border-color': '#dee2e6',
                    'border-width': 2,
                    'label': 'data(label)',
                    'text-valign': 'center',
                    'text-halign': 'center',
                    'color': '#333333',
                    'font-size': '12px',
                    'font-weight': 'bold',
                    'width': 120,
                    'height': 60,
                    'shape': 'roundrectangle'
                }
            },
            {
                selector: 'node[type="client"]',
                style: {
                    'background-color': '#e3f2fd',
                    'border-color': '#2196f3',
                    'color': '#1976d2'
                }
            },
            {
                selector: 'node[type="auth_server"]',
                style: {
                    'background-color': '#f3e5f5',
                    'border-color': '#9c27b0',
                    'color': '#7b1fa2'
                }
            },
            {
                selector: 'node[type="resource_server"]',
                style: {
                    'background-color': '#e8f5e8',
                    'border-color': '#4caf50',
                    'color': '#388e3c'
                }
            },
            {
                selector: 'node[type="user"]',
                style: {
                    'background-color': '#fff3e0',
                    'border-color': '#ff9800',
                    'color': '#f57c00',
                    'shape': 'ellipse'
                }
            },
            {
                selector: 'node[type="database"]',
                style: {
                    'background-color': '#fce4ec',
                    'border-color': '#e91e63',
                    'color': '#c2185b',
                    'shape': 'barrel'
                }
            },
            {
                selector: 'edge',
                style: {
                    'width': 2,
                    'line-color': '#666666',
                    'target-arrow-color': '#666666',
                    'target-arrow-shape': 'triangle',
                    'curve-style': 'bezier',
                    'label': 'data(label)',
                    'font-size': '10px',
                    'color': '#333333',
                    'text-rotation': 'autorotate',
                    'text-margin-y': -15,
                    'text-background-color': '#ffffff',
                    'text-background-padding': '3px'
                }
            },
            {
                selector: 'edge[type="redirect"]',
                style: {
                    'line-color': '#2196f3',
                    'target-arrow-color': '#2196f3',
                    'line-style': 'dashed'
                }
            },
            {
                selector: 'edge[type="api"]',
                style: {
                    'line-color': '#4caf50',
                    'target-arrow-color': '#4caf50',
                    'line-style': 'solid'
                }
            },
            {
                selector: 'edge[type="interaction"]',
                style: {
                    'line-color': '#ff9800',
                    'target-arrow-color': '#ff9800',
                    'line-style': 'dotted'
                }
            },
            {
                selector: 'edge[type="internal"]',
                style: {
                    'line-color': '#9c27b0',
                    'target-arrow-color': '#9c27b0',
                    'line-style': 'solid'
                }
            },
            {
                selector: '.highlighted',
                style: {
                    'background-color': '#ffeb3b',
                    'border-color': '#f57f17',
                    'border-width': 3,
                    'transition-property': 'background-color, border-color, border-width',
                    'transition-duration': '0.5s'
                }
            },
            {
                selector: '.active-flow',
                style: {
                    'line-color': '#ff5722',
                    'target-arrow-color': '#ff5722',
                    'width': 4,
                    'transition-property': 'line-color, target-arrow-color, width',
                    'transition-duration': '0.5s'
                }
            }
        ];
    }

    /**
     * Add interactive features to the flow
     */
    static addInteractiveFeatures(cy, flowType, authConfig) {
        // Add click handlers for nodes
        cy.on('tap', 'node', (event) => {
            const node = event.target;
            this.showNodeDetails(node, flowType, authConfig);
        });

        // Add click handlers for edges
        cy.on('tap', 'edge', (event) => {
            const edge = event.target;
            this.showEdgeDetails(edge);
        });

        // Add hover effects
        cy.on('mouseover', 'node', (event) => {
            const node = event.target;
            node.addClass('highlighted');
        });

        cy.on('mouseout', 'node', (event) => {
            const node = event.target;
            node.removeClass('highlighted');
        });

        // Add flow animation
        this.addFlowAnimation(cy);
    }

    /**
     * Show node details in a popup
     */
    static showNodeDetails(node, flowType, authConfig) {
        const nodeData = node.data();
        const nodeConfig = authConfig[nodeData.id] || {};

        // Create popup content
        const popupContent = `
            <div class="auth-node-popup">
                <h4>${nodeData.label}</h4>
                <p><strong>Type:</strong> ${nodeData.type}</p>
                ${nodeConfig.url ? `<p><strong>URL:</strong> ${nodeConfig.url}</p>` : ''}
                ${nodeConfig.description ? `<p><strong>Description:</strong> ${nodeConfig.description}</p>` : ''}
                
                ${this.getNodeTypeSpecificContent(nodeData.type, nodeConfig)}
                
                <div class="popup-actions">
                    <button onclick="AuthVisualizationService.configureNode('${nodeData.id}')">Configure</button>
                    <button onclick="AuthVisualizationService.testNode('${nodeData.id}')">Test</button>
                </div>
            </div>
        `;

        this.showPopup(popupContent, node.renderedPosition());
    }

    /**
     * Get node type specific content
     */
    static getNodeTypeSpecificContent(nodeType, config) {
        switch (nodeType) {
            case 'auth_server':
                return `
                    <div class="node-config">
                        <h5>Configuration</h5>
                        ${config.clientId ? `<p><strong>Client ID:</strong> ${config.clientId}</p>` : ''}
                        ${config.scopes ? `<p><strong>Scopes:</strong> ${config.scopes.join(', ')}</p>` : ''}
                        ${config.redirectUri ? `<p><strong>Redirect URI:</strong> ${config.redirectUri}</p>` : ''}
                    </div>
                `;
            case 'resource_server':
                return `
                    <div class="node-config">
                        <h5>Configuration</h5>
                        ${config.audience ? `<p><strong>Audience:</strong> ${config.audience}</p>` : ''}
                        ${config.issuer ? `<p><strong>Issuer:</strong> ${config.issuer}</p>` : ''}
                    </div>
                `;
            case 'api_server':
                return `
                    <div class="node-config">
                        <h5>Configuration</h5>
                        ${config.baseUrl ? `<p><strong>Base URL:</strong> ${config.baseUrl}</p>` : ''}
                        ${config.version ? `<p><strong>Version:</strong> ${config.version}</p>` : ''}
                    </div>
                `;
            default:
                return '';
        }
    }

    /**
     * Show edge details
     */
    static showEdgeDetails(edge) {
        const edgeData = edge.data();

        const popupContent = `
            <div class="auth-edge-popup">
                <h4>${edgeData.label}</h4>
                <p><strong>Type:</strong> ${edgeData.type}</p>
                <p><strong>From:</strong> ${edgeData.source}</p>
                <p><strong>To:</strong> ${edgeData.target}</p>
                
                ${this.getEdgeTypeSpecificContent(edgeData.type)}
                
                <div class="popup-actions">
                    <button onclick="AuthVisualizationService.simulateFlow('${edgeData.id}')">Simulate</button>
                </div>
            </div>
        `;

        this.showPopup(popupContent, edge.renderedMidpoint());
    }

    /**
     * Get edge type specific content
     */
    static getEdgeTypeSpecificContent(edgeType) {
        switch (edgeType) {
            case 'redirect':
                return '<p><strong>Method:</strong> HTTP Redirect (302)</p>';
            case 'api':
                return '<p><strong>Method:</strong> HTTP API Call</p>';
            case 'interaction':
                return '<p><strong>Method:</strong> User Interaction</p>';
            case 'internal':
                return '<p><strong>Method:</strong> Internal Service Call</p>';
            default:
                return '';
        }
    }

    /**
     * Show popup at position
     */
    static showPopup(content, position) {
        // Remove existing popup
        const existingPopup = document.querySelector('.auth-popup');
        if (existingPopup) {
            existingPopup.remove();
        }

        // Create new popup
        const popup = document.createElement('div');
        popup.className = 'auth-popup';
        popup.innerHTML = content;
        popup.style.position = 'absolute';
        popup.style.left = `${position.x}px`;
        popup.style.top = `${position.y}px`;
        popup.style.zIndex = '10000';
        popup.style.background = 'white';
        popup.style.border = '1px solid #ccc';
        popup.style.borderRadius = '8px';
        popup.style.padding = '16px';
        popup.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
        popup.style.maxWidth = '300px';

        document.body.appendChild(popup);

        // Auto-remove popup after 5 seconds
        setTimeout(() => {
            if (popup.parentNode) {
                popup.parentNode.removeChild(popup);
            }
        }, 5000);
    }

    /**
     * Add flow animation
     */
    static addFlowAnimation(cy) {
        const edges = cy.edges();
        let currentStep = 0;

        const animateFlow = () => {
            // Reset all edges
            edges.removeClass('active-flow');

            // Highlight current step
            if (currentStep < edges.length) {
                edges[currentStep].addClass('active-flow');
                currentStep++;
            } else {
                currentStep = 0;
            }
        };

        // Start animation
        setInterval(animateFlow, 2000);
    }

    /**
     * Configure node (placeholder for future implementation)
     */
    static configureNode(nodeId) {
        console.log(`Configuring node: ${nodeId}`);
        // This would open a configuration modal
    }

    /**
     * Test node (placeholder for future implementation)
     */
    static testNode(nodeId) {
        console.log(`Testing node: ${nodeId}`);
        // This would run a test against the node
    }

    /**
     * Simulate flow (placeholder for future implementation)
     */
    static simulateFlow(edgeId) {
        console.log(`Simulating flow: ${edgeId}`);
        // This would simulate the authentication flow step
    }

    /**
     * Export authentication flow as configuration
     */
    static exportAuthFlowConfig(flowType, authConfig) {
        const flowTemplate = this.getAuthFlowTemplate(flowType);
        if (!flowTemplate) {
            throw new Error(`Unsupported authentication flow: ${flowType}`);
        }

        const config = {
            flowType,
            flowName: flowTemplate.name,
            description: flowTemplate.description,
            configuration: authConfig,
            steps: flowTemplate.steps,
            flows: flowTemplate.flows,
            exportedAt: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(config, null, 2)], {
            type: 'application/json'
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `auth-flow-${flowType}-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        return config;
    }

    /**
     * Import authentication flow configuration
     */
    static importAuthFlowConfig(configFile) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const config = JSON.parse(e.target.result);
                    resolve(config);
                } catch (error) {
                    reject(new Error('Invalid configuration file'));
                }
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(configFile);
        });
    }

    /**
     * Get all supported authentication flows
     */
    static getAllSupportedFlows() {
        return Array.from(this.authFlows.entries()).map(([key, flow]) => ({
            type: key,
            name: flow.name,
            description: flow.description
        }));
    }

    /**
     * Clean up service
     */
    static cleanup() {
        // Remove any existing popups
        const popups = document.querySelectorAll('.auth-popup');
        popups.forEach(popup => popup.remove());
    }
}

export default AuthVisualizationService;
