import cytoscape from 'cytoscape';
import dagre from 'cytoscape-dagre';

// Register dagre layout
cytoscape.use(dagre);

/**
 * Network Flow Visualization Service
 * Provides MuleSoft-style API flow and network topology visualization
 */
export class NetworkFlowService {
    static instances = new Map();
    static flowTemplates = new Map();    /**
     * Initialize network flow visualization
     */
    static async initialize() {
        // Cytoscape is already imported as ES6 module, no need to load externally
        // Just load flow templates
        this.loadFlowTemplates();
    }

    /**
     * Detect and resolve overlapping nodes
     */
    static resolveNodeOverlaps(cy) {
        const nodes = cy.nodes();
        const overlappingNodes = [];

        // Check for overlapping nodes
        nodes.forEach(node => {
            const nodePos = node.position();
            const nodeWidth = node.width();
            const nodeHeight = node.height();

            nodes.forEach(otherNode => {
                if (node.id() !== otherNode.id()) {
                    const otherPos = otherNode.position();
                    const otherWidth = otherNode.width();
                    const otherHeight = otherNode.height();

                    // Check if nodes overlap
                    const xOverlap = Math.abs(nodePos.x - otherPos.x) < (nodeWidth + otherWidth) / 2;
                    const yOverlap = Math.abs(nodePos.y - otherPos.y) < (nodeHeight + otherHeight) / 2;

                    if (xOverlap && yOverlap) {
                        overlappingNodes.push({
                            node1: node,
                            node2: otherNode,
                            distance: Math.sqrt(Math.pow(nodePos.x - otherPos.x, 2) + Math.pow(nodePos.y - otherPos.y, 2))
                        });
                    }
                }
            });
        });

        // Resolve overlaps by repositioning nodes
        overlappingNodes.forEach(overlap => {
            const node1Pos = overlap.node1.position();
            const node2Pos = overlap.node2.position();

            // Calculate separation vector
            const dx = node2Pos.x - node1Pos.x;
            const dy = node2Pos.y - node1Pos.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // Minimum separation distance - optimized for compact layout
            const minSeparation = 60;

            if (distance < minSeparation) {
                // Handle case where nodes are exactly at the same position
                if (distance === 0) {
                    // Apply random offset to separate identical positions
                    const angle = Math.random() * 2 * Math.PI;
                    overlap.node2.position({
                        x: node1Pos.x + Math.cos(angle) * minSeparation,
                        y: node1Pos.y + Math.sin(angle) * minSeparation
                    });
                } else {
                    // Normalize and apply separation
                    const separationX = (dx / distance) * minSeparation;
                    const separationY = (dy / distance) * minSeparation;

                    overlap.node2.position({
                        x: node1Pos.x + separationX,
                        y: node1Pos.y + separationY
                    });
                }
            }
        });

        console.log(`Resolved ${overlappingNodes.length} node overlaps`);
        return overlappingNodes.length;
    }

    /**
     * Validate and repair edges with invalid endpoints
     */
    static validateAndRepairEdges(cy) {
        const edges = cy.edges();
        const invalidEdges = [];

        edges.forEach(edge => {
            const sourceNode = edge.source();
            const targetNode = edge.target();

            if (!sourceNode.length || !targetNode.length) {
                invalidEdges.push(edge);
                return;
            }

            const sourcePos = sourceNode.position();
            const targetPos = targetNode.position();

            // Check if source and target are at the same position
            if (sourcePos.x === targetPos.x && sourcePos.y === targetPos.y) {
                invalidEdges.push(edge);
                console.warn(`Edge ${edge.id()} has overlapping endpoints`, {
                    source: sourceNode.id(),
                    target: targetNode.id(),
                    position: sourcePos
                });
            }
        });

        // Remove invalid edges
        if (invalidEdges.length > 0) {
            cy.remove(invalidEdges);
            console.log(`Removed ${invalidEdges.length} invalid edges`);
        }

        return invalidEdges.length;
    }

    /**
     * Create API flow diagram from nodes and edges
     */
    static createApiFlowDiagram(containerId, nodes, edges, options = {}) {
        const defaultOptions = {
            layout: {
                name: 'dagre',
                directed: true,
                spacingFactor: 1.2,
                nodeDimensionsIncludeLabels: true,
                animate: false,
                animationDuration: 0,
                nodeSep: 50,
                edgeSep: 15,
                rankSep: 80,
                rankDir: 'TB',
                padding: 30,
                fit: true,
                nodeSpacing: function (node) {
                    return 10;
                },
                edgeSpacing: function (edge) {
                    return 8;
                },
                ranker: 'tight-tree',
                acyclicer: 'greedy',
                minLen: function (edge) {
                    return 1;
                }
            },
            style: [
                {
                    selector: 'node',
                    style: {
                        'background-color': function (ele) {
                            return ele.data('metadata')?.color || '#3b82f6';
                        },
                        'label': 'data(label)',
                        'text-valign': 'center',
                        'text-halign': 'center',
                        'color': '#ffffff',
                        'font-size': '12px',
                        'font-weight': '600',
                        'font-family': 'Inter, -apple-system, system-ui, sans-serif',
                        'width': 110,
                        'height': 70,
                        'text-wrap': 'wrap',
                        'text-max-width': '100px',
                        'border-width': 0,
                        'text-margin-y': 0,
                        'text-margin-x': 0,
                        'shape': 'round-rectangle',
                        'transition-property': 'background-color, width, height, border-width',
                        'transition-duration': '0.2s',
                        'transition-timing-function': 'ease-out'
                    }
                },
                {
                    selector: 'node[type="endpoint"]',
                    style: {
                        'background-color': function (ele) {
                            return ele.data('metadata')?.color || '#16a34a';
                        },
                        'shape': 'round-rectangle',
                        'width': 130,
                        'height': 60,
                        'text-max-width': '120px',
                        'border-width': 2,
                        'border-color': '#bbf7d0',
                        'border-style': 'solid'
                    }
                },
                {
                    selector: 'node[type="database"]',
                    style: {
                        'background-color': function (ele) {
                            return ele.data('metadata')?.color || '#2563eb';
                        },
                        'shape': 'round-rectangle',
                        'width': 110,
                        'height': 70,
                        'border-width': 2,
                        'border-color': '#bfdbfe',
                        'border-style': 'solid'
                    }
                },
                {
                    selector: 'node[type="service"]',
                    style: {
                        'background-color': function (ele) {
                            return ele.data('metadata')?.color || '#7c3aed';
                        },
                        'shape': 'round-rectangle',
                        'width': 110,
                        'height': 70,
                        'border-width': 2,
                        'border-color': '#e9d5ff',
                        'border-style': 'solid'
                    }
                },
                {
                    selector: 'node[type="gateway"]',
                    style: {
                        'background-color': function (ele) {
                            return ele.data('metadata')?.color || '#d97706';
                        },
                        'shape': 'round-rectangle',
                        'width': 120,
                        'height': 70,
                        'border-width': 2,
                        'border-color': '#fde68a',
                        'border-style': 'solid'
                    }
                },
                {
                    selector: 'edge',
                    style: {
                        'width': function (ele) {
                            return ele.data('weight') || 3;
                        },
                        'line-color': function (ele) {
                            switch (ele.data('type')) {
                                case 'http': return '#16a34a';
                                case 'database': return '#2563eb';
                                case 'cache': return '#d97706';
                                case 'auth': return '#dc2626';
                                case 'websocket': return '#7c3aed';
                                default: return '#64748b';
                            }
                        },
                        'target-arrow-color': function (ele) {
                            switch (ele.data('type')) {
                                case 'http': return '#16a34a';
                                case 'database': return '#2563eb';
                                case 'cache': return '#d97706';
                                case 'auth': return '#dc2626';
                                case 'websocket': return '#7c3aed';
                                default: return '#64748b';
                            }
                        },
                        'target-arrow-shape': 'triangle',
                        'target-arrow-size': 10,
                        'curve-style': 'bezier',
                        'control-point-step-size': 40,
                        'label': 'data(label)',
                        'font-size': '11px',
                        'font-weight': '500',
                        'font-family': 'Inter, -apple-system, system-ui, sans-serif',
                        'color': '#475569',
                        'text-background-color': '#ffffff',
                        'text-background-opacity': 0.9,
                        'text-background-padding': '4px',
                        'text-border-color': '#e2e8f0',
                        'text-border-width': 1,
                        'text-border-style': 'solid',
                        'source-distance-from-node': 5,
                        'target-distance-from-node': 5
                    }
                },
                {
                    selector: 'edge[type="http"]',
                    style: {
                        'line-color': '#059669',
                        'target-arrow-color': '#059669',
                        'line-style': 'solid',
                        'width': 2
                    }
                },
                {
                    selector: 'edge[type="websocket"]',
                    style: {
                        'line-color': '#1d4ed8',
                        'target-arrow-color': '#1d4ed8',
                        'line-style': 'dashed',
                        'line-dash-pattern': [8, 4],
                        'width': 2
                    }
                },
                {
                    selector: 'edge[type="auth"]',
                    style: {
                        'line-color': '#dc2626',
                        'target-arrow-color': '#dc2626',
                        'line-style': 'dotted',
                        'line-dash-pattern': [3, 3],
                        'width': 2
                    }
                },
                {
                    selector: 'node[metadata.websiteType="E-Commerce"]',
                    style: {
                        'border-color': '#059669',
                        'border-width': 2,
                        'border-style': 'solid',
                        'background-color': function (ele) {
                            return ele.data('metadata')?.color || '#059669';
                        }
                    }
                },
                {
                    selector: 'node[metadata.websiteType="Content Site"]',
                    style: {
                        'border-color': '#7c3aed',
                        'border-width': 2,
                        'border-style': 'solid',
                        'background-color': function (ele) {
                            return ele.data('metadata')?.color || '#7c3aed';
                        }
                    }
                },
                {
                    selector: 'node[metadata.websiteType="SaaS Application"]',
                    style: {
                        'border-color': '#1d4ed8',
                        'border-width': 2,
                        'border-style': 'solid',
                        'background-color': function (ele) {
                            return ele.data('metadata')?.color || '#1d4ed8';
                        }
                    }
                },
                {
                    selector: 'node[metadata.websiteType="Social Platform"]',
                    style: {
                        'border-color': '#d97706',
                        'border-width': 2,
                        'border-style': 'solid',
                        'background-color': function (ele) {
                            return ele.data('metadata')?.color || '#d97706';
                        }
                    }
                },
                {
                    selector: 'node[metadata.websiteType="Static Site"]',
                    style: {
                        'border-color': '#6b7280',
                        'border-width': 2,
                        'border-style': 'solid',
                        'background-color': function (ele) {
                            return ele.data('metadata')?.color || '#6b7280';
                        }
                    }
                },
                {
                    selector: 'edge[type="database"]',
                    style: {
                        'line-color': '#7c3aed',
                        'target-arrow-color': '#7c3aed',
                        'line-style': 'dotted',
                        'curve-style': 'straight',
                        'width': 2
                    }
                },
                {
                    selector: 'edge[type="cache"]',
                    style: {
                        'line-color': '#d97706',
                        'target-arrow-color': '#d97706',
                        'line-style': 'dashed',
                        'curve-style': 'straight',
                        'width': 2
                    }
                },
                {
                    selector: ':selected',
                    style: {
                        'border-width': 3,
                        'border-color': '#f59e0b',
                        'border-opacity': 1,
                        'border-style': 'solid'
                    }
                }
            ],
            ...options
        };

        // Transform nodes and edges to Cytoscape format with validation
        const nodeIds = new Set();
        const processedNodes = [];

        // Process nodes and ensure unique IDs
        nodes.forEach((node, index) => {
            let nodeId = node.id;
            if (nodeIds.has(nodeId)) {
                nodeId = `${nodeId}-${index}`;
                console.warn(`Duplicate node ID detected, renamed to: ${nodeId}`);
            }
            nodeIds.add(nodeId);

            processedNodes.push({
                data: {
                    id: nodeId,
                    label: node.label || node.name || nodeId,
                    type: node.type || 'service',
                    weight: node.weight || 50,
                    metadata: node.metadata || {}
                }
            });
        });

        const validEdges = edges.filter(edge => {
            // Validate edge has valid source and target
            if (!edge.source || !edge.target) {
                console.warn(`Invalid edge: missing source or target`, edge);
                return false;
            }

            // Validate source and target nodes exist
            if (!nodeIds.has(edge.source)) {
                console.warn(`Invalid edge: source node '${edge.source}' not found`, edge);
                return false;
            }

            if (!nodeIds.has(edge.target)) {
                console.warn(`Invalid edge: target node '${edge.target}' not found`, edge);
                return false;
            }

            // Prevent self-loops (source and target are the same)
            if (edge.source === edge.target) {
                console.warn(`Invalid edge: self-loop detected for node '${edge.source}'`, edge);
                return false;
            }

            return true;
        });

        const elements = [
            ...processedNodes,
            ...validEdges.map((edge, index) => ({
                data: {
                    id: edge.id || `edge-${edge.source}-${edge.target}-${index}`,
                    source: edge.source,
                    target: edge.target,
                    label: edge.label || edge.method || '',
                    type: edge.type || 'http',
                    metadata: edge.metadata || {}
                }
            }))
        ];

        // Create Cytoscape instance with error handling
        let cy;
        try {
            const container = document.getElementById(containerId);
            if (!container) {
                throw new Error(`Container with ID '${containerId}' not found`);
            }

            cy = cytoscape({
                container: container,
                elements: elements,
                wheelSensitivity: 0.1,
                minZoom: 0.1,
                maxZoom: 3.0,
                zoomingEnabled: true,
                panningEnabled: true,
                boxSelectionEnabled: false,
                autoungrabify: false,
                autounselectify: false,
                ...defaultOptions
            });

            // Apply layout with proper sequencing
            const layout = cy.layout(defaultOptions.layout);

            // Start with a promise to properly handle the layout completion
            return new Promise((resolve, reject) => {
                layout.on('layoutstop', () => {
                    // Small delay to ensure layout is fully settled
                    setTimeout(() => {
                        try {
                            // Resolve node overlaps first
                            const overlapCount = this.resolveNodeOverlaps(cy);

                            // Then validate and repair edges
                            const invalidEdgeCount = this.validateAndRepairEdges(cy);

                            // Fit the diagram to the container with better options
                            cy.fit(cy.elements(), 30); // Reduced padding for tighter fit

                            // Ensure optimal zoom level for readability
                            const currentZoom = cy.zoom();
                            if (currentZoom < 0.5) {
                                cy.zoom(0.5);
                                cy.center();
                            } else if (currentZoom > 2.0) {
                                cy.zoom(2.0);
                                cy.center();
                            }

                            if (overlapCount > 0 || invalidEdgeCount > 0) {
                                console.log(`Fixed ${overlapCount} overlapping nodes and ${invalidEdgeCount} invalid edges`);
                            }

                            // Add event listeners
                            this.addFlowInteractions(cy);

                            // Add resize handler
                            window.addEventListener('resize', () => {
                                if (cy) {
                                    cy.resize();
                                    cy.fit(cy.elements(), 30);
                                }
                            });

                            // Store instance
                            this.instances.set(containerId, cy);

                            console.log(`Created flow diagram with ${elements.filter(e => e.data.source).length} edges and ${elements.filter(e => !e.data.source).length} nodes`);

                            resolve(cy);
                        } catch (error) {
                            reject(error);
                        }
                    }, 100);
                });

                layout.run();
            });

        } catch (error) {
            console.error('Error creating Cytoscape instance:', error);
            console.log('Elements that caused the error:', elements);

            // Show error in container
            const container = document.getElementById(containerId);
            if (container) {
                container.innerHTML = `
                    <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #ff4444;">
                        <div>
                            <h4>Error creating flow diagram</h4>
                            <p>${error.message}</p>
                            <p>Check console for details.</p>
                        </div>
                    </div>
                `;
            }
            throw error;
        }
    }

    /**
     * Generate network topology from API specification
     */
    static generateNetworkTopology(apiSpec, options = {}) {
        const nodes = [];
        const edges = [];

        // Extract endpoints from OpenAPI spec
        if (apiSpec.paths) {
            Object.entries(apiSpec.paths).forEach(([path, methods]) => {
                const endpointId = `endpoint-${path.replace(/[^a-zA-Z0-9]/g, '-')}`;

                nodes.push({
                    id: endpointId,
                    label: path,
                    type: 'endpoint',
                    metadata: {
                        path: path,
                        methods: Object.keys(methods)
                    }
                });

                // Add method-specific nodes
                Object.entries(methods).forEach(([method, operation]) => {
                    const methodId = `${endpointId}-${method}`;

                    nodes.push({
                        id: methodId,
                        label: `${method.toUpperCase()}`,
                        type: 'method',
                        metadata: {
                            method: method,
                            operation: operation
                        }
                    });

                    edges.push({
                        source: endpointId,
                        target: methodId,
                        label: method.toUpperCase(),
                        type: 'http'
                    });

                    // Add response nodes
                    if (operation.responses) {
                        Object.entries(operation.responses).forEach(([status, response]) => {
                            const responseId = `${methodId}-response-${status}`;

                            nodes.push({
                                id: responseId,
                                label: `${status}`,
                                type: 'response',
                                metadata: {
                                    status: status,
                                    response: response
                                }
                            });

                            edges.push({
                                source: methodId,
                                target: responseId,
                                label: status,
                                type: 'response'
                            });
                        });
                    }
                });
            });
        }

        return { nodes, edges };
    }

    /**
     * Create real-time API flow visualization
     */
    static async createRealtimeFlow(containerId, options = {}) {
        // Extract request URL from options or use default
        const requestUrl = options.requestUrl || '';
        const requestMethod = options.requestMethod || 'GET';
        const headers = options.headers || {};
        const requestBody = options.requestBody || null;

        // Parse URL components
        let hostname = 'API Service';
        let path = '/';
        let protocol = 'https';
        let port = '';

        try {
            if (requestUrl) {
                const url = new URL(requestUrl);
                hostname = url.hostname;
                path = url.pathname || '/';
                protocol = url.protocol.replace(':', '');
                port = url.port ? `:${url.port}` : '';
            }
        } catch (e) {
            // If URL parsing fails, try to extract domain from string
            const domainMatch = requestUrl.match(/https?:\/\/([^/:]+)/);
            if (domainMatch && domainMatch[1]) {
                hostname = domainMatch[1];

                // Extract path if available
                const pathMatch = requestUrl.match(/https?:\/\/[^/]+(\/.*)/);
                if (pathMatch && pathMatch[1]) {
                    path = pathMatch[1];
                }

                // Extract protocol
                const protocolMatch = requestUrl.match(/^(https?):\/\//);
                if (protocolMatch && protocolMatch[1]) {
                    protocol = protocolMatch[1];
                }

                // Extract port if available
                const portMatch = requestUrl.match(/:(\d+)/);
                if (portMatch && portMatch[1]) {
                    port = `:${portMatch[1]}`;
                }
            }
        }

        // Detect website type and backend technology
        const isApiEndpoint = this.detectIfApiEndpoint(path, requestMethod, headers);
        const websiteType = !isApiEndpoint ?
            this.detectWebsiteType(requestUrl, path, headers, requestMethod, requestBody) :
            { type: 'API Service', architecture: 'RESTful API', color: '#ef4444', icon: 'server' };
        const backendTech = this.detectBackendTechnology(path, headers);

        // Check for authentication headers
        const hasAuth = Object.keys(headers).some(header =>
            header.toLowerCase().includes('auth') ||
            header.toLowerCase() === 'authorization' ||
            header.toLowerCase() === 'x-api-key'
        );

        // Check for content-type
        const contentType = headers['Content-Type'] || headers['content-type'] || '';
        const isJson = contentType.includes('json');
        const isForm = contentType.includes('form');
        const isGraphQL = path.includes('graphql') || requestBody?.includes('query');

        // Create flow data structure with client node
        const flowData = {
            nodes: [
                {
                    id: 'client',
                    label: 'Client App',
                    type: 'service',
                    metadata: {
                        type: 'Client Application',
                        details: 'User Agent',
                        color: '#3b82f6'
                    }
                }
            ],
            edges: []
        };

        // Add architecture-specific nodes based on website type
        if (protocol === 'https') {
            // Add CDN/Edge for most websites
            const cdnId = 'cdn';
            flowData.nodes.push({
                id: cdnId,
                label: isApiEndpoint ? 'API Gateway' : 'CDN/Edge',
                type: 'gateway',
                metadata: {
                    protocol,
                    details: isApiEndpoint ? 'API Gateway' : 'Content Delivery Network',
                    color: isApiEndpoint ? '#ef4444' : '#0ea5e9'
                }
            });
            flowData.edges.push({
                source: 'client',
                target: cdnId,
                label: 'HTTPS',
                type: 'http'
            });

            // Add firewall/security node for secure endpoints
            if (hasAuth || hostname.includes('secure') || path.includes('secure') ||
                hostname.includes('api') || hostname.includes('admin')) {
                const securityId = 'security';
                flowData.nodes.push({
                    id: securityId,
                    label: 'WAF/Security',
                    type: 'gateway',
                    metadata: {
                        details: 'Web Application Firewall',
                        color: '#f43f5e'
                    }
                });
                flowData.edges.push({
                    source: cdnId,
                    target: securityId,
                    label: 'Filter',
                    type: 'http'
                });

                // Connect to next layer - load balancer
                const lbId = 'loadbalancer';
                flowData.nodes.push({
                    id: lbId,
                    label: 'Load Balancer',
                    type: 'gateway',
                    metadata: {
                        details: 'Traffic Distribution',
                        color: '#8b5cf6'
                    }
                });
                flowData.edges.push({
                    source: securityId,
                    target: lbId,
                    label: 'Route',
                    type: 'http'
                });

                // Connect to host server
                const serverId = 'webserver';
                flowData.nodes.push({
                    id: serverId,
                    label: `${hostname}${port}`,
                    type: 'gateway',
                    metadata: {
                        url: `${protocol}://${hostname}${port}`,
                        details: backendTech.name,
                        color: backendTech.color || '#10b981'
                    }
                });
                flowData.edges.push({
                    source: lbId,
                    target: serverId,
                    label: 'Forward',
                    type: 'http'
                });
            } else {
                // Simpler architecture without WAF/security
                const serverId = 'webserver';
                flowData.nodes.push({
                    id: serverId,
                    label: `${hostname}${port}`,
                    type: 'gateway',
                    metadata: {
                        url: `${protocol}://${hostname}${port}`,
                        details: backendTech.name,
                        color: backendTech.color || '#10b981'
                    }
                });
                flowData.edges.push({
                    source: cdnId,
                    target: serverId,
                    label: 'HTTPS',
                    type: 'http'
                });
            }
        } else {
            // HTTP connection (not secure)
            const serverId = 'server';
            flowData.nodes.push({
                id: serverId,
                label: `${hostname}${port}`,
                type: 'gateway',
                metadata: {
                    url: `${protocol}://${hostname}${port}`,
                    details: isApiEndpoint ? 'API Server' : backendTech.name,
                    color: isApiEndpoint ? '#ef4444' : backendTech.color || '#10b981'
                }
            });
            flowData.edges.push({
                source: 'client',
                target: serverId,
                label: 'HTTP',
                type: 'http'
            });
        }

        // Get source node (last in the chain to the server)
        const sourceNode = flowData.nodes.find(n =>
            n.id === 'webserver' || n.id === 'server');

        // Add specific endpoint based on path and method
        const apiNodeId = 'api';
        flowData.nodes.push({
            id: apiNodeId,
            label: `${requestMethod} ${path}`,
            type: 'endpoint',
            metadata: {
                method: requestMethod,
                path: path,
                contentType,
                websiteType: websiteType.type,
                color: websiteType.color || '#3b82f6'
            }
        });
        flowData.edges.push({
            source: sourceNode.id,
            target: apiNodeId,
            label: requestMethod,
            type: 'http'
        });

        // Add auth service if authentication headers are present
        if (hasAuth) {
            const authType = this.detectAuthType(headers);
            flowData.nodes.push({
                id: 'auth',
                label: authType,
                type: 'service',
                metadata: {
                    authType: authType,
                    color: '#f97316'
                }
            });
            flowData.edges.push({
                source: sourceNode.id,
                target: 'auth',
                label: 'Validate',
                type: 'http'
            });
            // Connect auth to API endpoint
            flowData.edges.push({
                source: 'auth',
                target: apiNodeId,
                label: 'Authorize',
                type: 'auth'
            });
        }

        // Add website-type specific nodes for non-API endpoints with more distinct architecture patterns
        if (websiteType.components) {
            // Create component nodes with different layouts based on the architecture type
            const layout = websiteType.layout || 'simple';

            // Generate component nodes
            const componentNodes = websiteType.components.map((component, index) => {
                const componentId = `component-${index}`;
                const componentName = component.split('-').map(word =>
                    word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

                return {
                    id: componentId,
                    label: componentName,
                    type: 'service',
                    metadata: {
                        websiteType: websiteType.type,
                        architecture: websiteType.architecture,
                        color: websiteType.color,
                        component: component,
                        index: index
                    }
                };
            });

            // Add all component nodes
            flowData.nodes.push(...componentNodes);

            // Connect components based on the architecture layout pattern
            switch (layout) {
                case 'microservices':
                    // Hub and spoke pattern with API Gateway
                    componentNodes.forEach(node => {
                        flowData.edges.push({
                            source: apiNodeId,
                            target: node.id,
                            label: 'Request',
                            type: 'http'
                        });
                    });
                    break;

                case 'complex':
                    // E-commerce-style tiered architecture
                    if (componentNodes.length > 0) {
                        // Connect API endpoint to first component
                        flowData.edges.push({
                            source: apiNodeId,
                            target: componentNodes[0].id,
                            label: 'Request',
                            type: 'http'
                        });

                        // Create interconnected services
                        for (let i = 0; i < componentNodes.length - 1; i++) {
                            flowData.edges.push({
                                source: componentNodes[i].id,
                                target: componentNodes[i + 1].id,
                                label: 'Process',
                                type: 'http'
                            });
                        }

                        // Add some cross-connections for complex flows
                        if (componentNodes.length > 3) {
                            flowData.edges.push({
                                source: componentNodes[0].id,
                                target: componentNodes[2].id,
                                label: 'Validate',
                                type: 'http'
                            });

                            flowData.edges.push({
                                source: componentNodes[1].id,
                                target: componentNodes[3].id,
                                label: 'Query',
                                type: 'database'
                            });
                        }
                    }
                    break;

                case 'content-focused':
                    // CMS-style pattern with central CMS core
                    if (componentNodes.length > 0) {
                        // Find the CMS core component
                        const cmsCore = componentNodes.find(n => n.metadata.component === 'cms-core') || componentNodes[0];

                        // Connect API to CMS core
                        flowData.edges.push({
                            source: apiNodeId,
                            target: cmsCore.id,
                            label: 'Request',
                            type: 'http'
                        });

                        // Connect other components to CMS core
                        componentNodes.forEach(node => {
                            if (node.id !== cmsCore.id) {
                                flowData.edges.push({
                                    source: cmsCore.id,
                                    target: node.id,
                                    label: 'Use',
                                    type: 'http'
                                });
                            }
                        });
                    }
                    break;

                case 'distributed':
                    // SaaS multi-tenant architecture
                    if (componentNodes.length > 0) {
                        // Find the frontend app and tenant manager components
                        const frontendApp = componentNodes.find(n => n.metadata.component === 'frontend-app') || componentNodes[0];
                        const tenantManager = componentNodes.find(n => n.metadata.component === 'tenant-manager') ||
                            (componentNodes.length > 1 ? componentNodes[1] : componentNodes[0]);

                        // Connect API to frontend
                        flowData.edges.push({
                            source: apiNodeId,
                            target: frontendApp.id,
                            label: 'Request',
                            type: 'http'
                        });

                        // Connect frontend to tenant manager
                        flowData.edges.push({
                            source: frontendApp.id,
                            target: tenantManager.id,
                            label: 'Resolve Tenant',
                            type: 'http'
                        });

                        // Connect tenant manager to other services
                        componentNodes.forEach(node => {
                            if (node.id !== frontendApp.id && node.id !== tenantManager.id) {
                                flowData.edges.push({
                                    source: tenantManager.id,
                                    target: node.id,
                                    label: 'Use',
                                    type: 'http'
                                });
                            }
                        });
                    }
                    break;

                case 'network':
                    // Social media style with multiple interconnected services
                    if (componentNodes.length > 0) {
                        // Connect API to user graph
                        const userGraph = componentNodes.find(n => n.metadata.component === 'user-graph') || componentNodes[0];

                        flowData.edges.push({
                            source: apiNodeId,
                            target: userGraph.id,
                            label: 'Query',
                            type: 'http'
                        });

                        // Create a network of interconnected services
                        for (let i = 0; i < componentNodes.length; i++) {
                            for (let j = i + 1; j < componentNodes.length; j++) {
                                if (Math.random() > 0.3) { // 70% chance of connection
                                    flowData.edges.push({
                                        source: componentNodes[i].id,
                                        target: componentNodes[j].id,
                                        label: 'Interact',
                                        type: i % 2 === 0 ? 'http' : 'websocket'
                                    });
                                }
                            }
                        }
                    }
                    break;

                case 'streaming':
                    // Streaming media pattern
                    if (componentNodes.length > 0) {
                        // Find CDN and catalog components
                        const cdn = componentNodes.find(n => n.metadata.component === 'content-delivery-network') ||
                            (componentNodes.length > 1 ? componentNodes[1] : componentNodes[0]);
                        const catalog = componentNodes.find(n => n.metadata.component === 'media-catalog') || componentNodes[0];

                        // Connect API to catalog
                        flowData.edges.push({
                            source: apiNodeId,
                            target: catalog.id,
                            label: 'Browse',
                            type: 'http'
                        });

                        // Connect catalog to CDN
                        flowData.edges.push({
                            source: catalog.id,
                            target: cdn.id,
                            label: 'Stream',
                            type: 'http'
                        });

                        // Connect other components in a pipeline
                        let lastNode = cdn;
                        componentNodes.forEach(node => {
                            if (node.id !== catalog.id && node.id !== cdn.id) {
                                flowData.edges.push({
                                    source: lastNode.id,
                                    target: node.id,
                                    label: 'Process',
                                    type: 'http'
                                });
                                lastNode = node;
                            }
                        });

                        // Add feedback loop to recommendation engine if it exists
                        const recommendationEngine = componentNodes.find(n =>
                            n.metadata.component === 'recommendation-engine');

                        if (recommendationEngine) {
                            flowData.edges.push({
                                source: apiNodeId,
                                target: recommendationEngine.id,
                                label: 'User Preference',
                                type: 'websocket'
                            });
                        }
                    }
                    break;

                case 'hub-and-spoke':
                    // GraphQL pattern
                    if (componentNodes.length > 0) {
                        // Find GraphQL server component
                        const graphqlServer = componentNodes.find(n => n.metadata.component === 'graphql-server') || componentNodes[0];

                        // Connect API to GraphQL server
                        flowData.edges.push({
                            source: apiNodeId,
                            target: graphqlServer.id,
                            label: 'Query',
                            type: 'http'
                        });

                        // Connect GraphQL server to other components
                        componentNodes.forEach(node => {
                            if (node.id !== graphqlServer.id) {
                                flowData.edges.push({
                                    source: graphqlServer.id,
                                    target: node.id,
                                    label: 'Resolve',
                                    type: 'http'
                                });
                            }
                        });
                    }
                    break;

                case 'frontend-heavy':
                    // SPA architecture
                    if (componentNodes.length > 0) {
                        // Find UI and router components
                        const uiComponents = componentNodes.find(n => n.metadata.component === 'ui-components') || componentNodes[0];
                        const router = componentNodes.find(n => n.metadata.component === 'router') ||
                            (componentNodes.length > 3 ? componentNodes[3] : componentNodes[0]);

                        // Connect API to UI
                        flowData.edges.push({
                            source: apiNodeId,
                            target: uiComponents.id,
                            label: 'Load',
                            type: 'http'
                        });

                        // Create frontend component dependencies
                        if (componentNodes.length > 1) {
                            // Create a chain of component dependencies
                            for (let i = 0; i < componentNodes.length - 1; i++) {
                                flowData.edges.push({
                                    source: componentNodes[i].id,
                                    target: componentNodes[i + 1].id,
                                    label: 'Use',
                                    type: 'http'
                                });
                            }

                            // Add router special connections
                            if (router) {
                                componentNodes.forEach(node => {
                                    if (node.id !== router.id && Math.random() > 0.5) {
                                        flowData.edges.push({
                                            source: router.id,
                                            target: node.id,
                                            label: 'Route',
                                            type: 'http'
                                        });
                                    }
                                });
                            }
                        }
                    }
                    break;

                case 'static':
                    // Static site architecture
                    if (componentNodes.length > 0) {
                        // Simple linear flow for static sites
                        // Connect API to first component
                        flowData.edges.push({
                            source: apiNodeId,
                            target: componentNodes[0].id,
                            label: 'Serve',
                            type: 'http'
                        });

                        // Chain the components
                        for (let i = 0; i < componentNodes.length - 1; i++) {
                            flowData.edges.push({
                                source: componentNodes[i].id,
                                target: componentNodes[i + 1].id,
                                label: 'Optimize',
                                type: 'http'
                            });
                        }
                    }
                    break;

                default:
                    // Simple linear flow (default)
                    if (componentNodes.length > 0) {
                        // Connect API endpoint to first component
                        flowData.edges.push({
                            source: apiNodeId,
                            target: componentNodes[0].id,
                            label: 'Process',
                            type: 'http'
                        });

                        // Chain the components
                        for (let i = 0; i < componentNodes.length - 1; i++) {
                            flowData.edges.push({
                                source: componentNodes[i].id,
                                target: componentNodes[i + 1].id,
                                label: 'Use',
                                type: 'http'
                            });
                        }
                    }
            }
        }

        // Add database node with more specific type based on endpoint
        const dataRelatedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
        if (dataRelatedMethods.includes(requestMethod.toUpperCase())) {
            const dbInfo = this.detectDatabaseType(path, requestBody);
            flowData.nodes.push({
                id: 'database',
                label: dbInfo.name,
                type: 'database',
                metadata: {
                    dbType: dbInfo.type,
                    operation: requestMethod === 'GET' ? 'Query' : 'Update',
                    color: dbInfo.color || '#3b82f6',
                    icon: dbInfo.icon || 'database'
                }
            });

            // Determine the source node for the database connection
            let dbSourceNode = apiNodeId;
            if (!isApiEndpoint && websiteType.components && websiteType.components.length > 0) {
                dbSourceNode = `component-${websiteType.components.length - 1}`;
            }

            flowData.edges.push({
                source: dbSourceNode,
                target: 'database',
                label: requestMethod === 'GET' ? 'Query' : 'Update',
                type: 'database'
            });
        }

        // Add cache node with specific type for GET requests
        if (requestMethod.toUpperCase() === 'GET' ||
            Object.keys(headers).some(h => h.toLowerCase().includes('cache'))) {
            const cacheInfo = this.detectCacheType(headers);
            flowData.nodes.push({
                id: 'cache',
                label: cacheInfo.name,
                type: 'service',
                metadata: {
                    cacheType: cacheInfo.type,
                    cacheControl: headers['cache-control'] || 'default',
                    color: cacheInfo.color || '#f59e0b',
                    icon: cacheInfo.icon || 'hard-drive'
                }
            });
            flowData.edges.push({
                source: apiNodeId,
                target: 'cache',
                label: 'Check',
                type: 'cache'
            });
        }

        // Add data processing node for requests with body
        if (requestBody) {
            const processorType = isJson ? 'JSON Processor' :
                isForm ? 'Form Processor' : 'Data Processor';
            flowData.nodes.push({
                id: 'processor',
                label: processorType,
                type: 'service',
                metadata: {
                    dataType: isJson ? 'JSON' : isForm ? 'Form Data' : 'Raw Data',
                    bodySize: requestBody?.length || 0,
                    color: isJson ? '#0ea5e9' : isForm ? '#8b5cf6' : '#6b7280'
                }
            });
            flowData.edges.push({
                source: apiNodeId,
                target: 'processor',
                label: 'Process',
                type: 'http'
            });
        }

        // Add GraphQL specific nodes
        if (isGraphQL) {
            flowData.nodes.push({
                id: 'graphql',
                label: 'GraphQL Engine',
                type: 'service',
                metadata: {
                    type: 'GraphQL',
                    color: '#d946ef'
                }
            });
            flowData.edges.push({
                source: apiNodeId,
                target: 'graphql',
                label: 'Query',
                type: 'http'
            });
            // Connect GraphQL to database
            if (flowData.nodes.find(n => n.id === 'database')) {
                flowData.edges.push({
                    source: 'graphql',
                    target: 'database',
                    label: 'Resolve',
                    type: 'database'
                });
            }
        }

        try {
            // Create the flow diagram with dynamic data
            const cy = await this.createApiFlowDiagram(containerId, flowData.nodes, flowData.edges, options);

            // Add animation effects if requested
            if (options.animate) {
                this.animateFlowDiagram(cy, flowData.edges);
            }

            // Add real-time updates
            this.addRealtimeUpdates(cy);

            return cy;
        } catch (error) {
            console.error('Error creating real-time flow:', error);
            throw error;
        }
    }

    /**
     * Detect if a path is likely an API endpoint rather than a website
     */
    static detectIfApiEndpoint(path, method, headers) {
        // Check path patterns common for APIs
        const apiPatterns = [
            /\/api\//i,
            /\/v\d+\//i,
            /\.(json|xml)$/i,
            /\/graphql/i,
            /\/rest\//i,
            /\/service\//i,
            /\/gql\//i,
            /\/query/i,
            /\/webhook/i,
            /\/callback/i,
            /\/rpc/i
        ];

        // Check content-type and accept headers that indicate API usage
        const apiContentTypes = [
            'application/json',
            'application/xml',
            'application/graphql',
            'application/ld+json',
            'application/vnd.',
            'application/hal+json'
        ];

        // Check method - APIs often use specific methods
        const apiMethods = ['PUT', 'PATCH', 'DELETE', 'OPTIONS'];

        // Check if path matches API patterns
        if (apiPatterns.some(pattern => pattern.test(path))) {
            return true;
        }

        // Check if content-type or accept headers indicate API
        const contentType = headers['Content-Type'] || headers['content-type'] || '';
        const accept = headers['Accept'] || headers['accept'] || '';
        if (apiContentTypes.some(type => contentType.includes(type) || accept.includes(type))) {
            return true;
        }

        // Check for API-specific headers
        const apiSpecificHeaders = [
            'x-api-key',
            'api-key',
            'apikey',
            'x-functions-key',
            'authorization',
            'x-amz-',
            'x-ms-',
            'x-goog-'
        ];

        if (Object.keys(headers).some(header =>
            apiSpecificHeaders.some(apiHeader => header.toLowerCase().includes(apiHeader)))) {
            return true;
        }

        // Check if using API-specific methods
        if (apiMethods.includes(method.toUpperCase())) {
            return true;
        }

        // If POST method and has JSON content, likely API
        if (method.toUpperCase() === 'POST' && contentType.includes('json')) {
            return true;
        }

        // Default to false for regular website requests
        return false;
    }

    /**
     * Detect authentication type from headers
     */
    static detectAuthType(headers) {
        const authHeader = headers['Authorization'] || headers['authorization'] || '';
        if (authHeader.startsWith('Bearer ')) {
            return 'JWT/OAuth';
        } else if (authHeader.startsWith('Basic ')) {
            return 'Basic Auth';
        } else if (authHeader.startsWith('Digest ')) {
            return 'Digest Auth';
        } else if (headers['x-api-key']) {
            return 'API Key';
        } else if (Object.keys(headers).some(h => h.toLowerCase().includes('auth'))) {
            return 'Custom Auth';
        }
        return 'Authentication';
    }

    /**
     * Detect website type and architecture based on URL, path, and request details
     */
    static detectWebsiteType(url, path, headers, method, body) {
        // Default website type
        let websiteType = {
            type: 'General Website',
            architecture: 'Standard Web',
            color: '#2563eb', // Default blue
            icon: 'globe',
            layout: 'simple',
            components: ['web-server']
        };

        // Parse domain from URL for more specific detection
        let domain = '';
        try {
            if (url) {
                const urlObj = new URL(url);
                domain = urlObj.hostname;
            }
        } catch (e) {
            // Extract domain using regex if URL parsing fails
            const domainMatch = url.match(/https?:\/\/([^/:]+)/);
            if (domainMatch && domainMatch[1]) {
                domain = domainMatch[1];
            }
        }

        // Content type and body hints
        const contentType = headers['Content-Type'] || headers['content-type'] || '';
        const acceptHeader = headers['Accept'] || headers['accept'] || '';
        const isJson = contentType.includes('json') || acceptHeader.includes('json');
        const isXml = contentType.includes('xml') || acceptHeader.includes('xml');
        const isGraphQL = path.includes('graphql') || (body && typeof body === 'string' && body.includes('query'));
        const isForm = contentType.includes('form');

        // E-commerce detection
        if (
            path.match(/\/(cart|checkout|product|shop|store|order|payment)/i) ||
            domain.match(/(shop|store|mall|market|cart|buy)/i)
        ) {
            websiteType = {
                type: 'E-Commerce',
                architecture: 'Multi-Tier Shopping Platform',
                color: '#047857', // Green
                icon: 'shopping-cart',
                layout: 'complex',
                components: [
                    'product-catalog',
                    'payment-gateway',
                    'inventory-service',
                    'cart-service',
                    'order-processing',
                    'product-recommendation'
                ]
            };
        }
        // Blog or content site detection
        else if (
            path.match(/\/(post|article|blog|news|story|feed)/i) ||
            domain.match(/(blog|news|post|article|media)/i)
        ) {
            websiteType = {
                type: 'Content Site',
                architecture: 'CMS Architecture',
                color: '#7c3aed', // Purple
                icon: 'file-text',
                layout: 'content-focused',
                components: [
                    'cms-core',
                    'content-db',
                    'media-storage',
                    'comments-service',
                    'search-index'
                ]
            };
        }
        // SaaS application detection
        else if (
            path.match(/\/(dashboard|account|settings|profile|subscription|billing)/i) ||
            domain.match(/(app|portal|cloud|software|saas)/i)
        ) {
            websiteType = {
                type: 'SaaS Application',
                architecture: 'Multi-Tenant Cloud',
                color: '#0284c7', // Cyan
                icon: 'layers',
                layout: 'distributed',
                components: [
                    'frontend-app',
                    'tenant-manager',
                    'auth-service',
                    'subscription-service',
                    'user-management',
                    'analytics-engine'
                ]
            };
        }
        // Social media detection
        else if (
            path.match(/\/(profile|user|feed|timeline|friends|follow)/i) ||
            domain.match(/(social|community|connect|network)/i)
        ) {
            websiteType = {
                type: 'Social Platform',
                architecture: 'Real-time Activity Feed',
                color: '#f59e0b', // Amber
                icon: 'users',
                layout: 'network',
                components: [
                    'user-graph',
                    'content-feed',
                    'notification-service',
                    'message-queue',
                    'recommendation-engine',
                    'engagement-tracker'
                ]
            };
        }
        // Streaming service detection
        else if (
            path.match(/\/(video|stream|media|watch|player|movie)/i) ||
            domain.match(/(stream|video|play|watch|media)/i)
        ) {
            websiteType = {
                type: 'Streaming Service',
                architecture: 'Media Streaming Platform',
                color: '#dc2626', // Red
                icon: 'video',
                layout: 'streaming',
                components: [
                    'media-catalog',
                    'content-delivery-network',
                    'media-storage',
                    'transcoding-service',
                    'recommendation-engine',
                    'streaming-analytics'
                ]
            };
        }
        // API platform detection
        else if (
            isJson || isXml || isGraphQL ||
            path.match(/\/api\/|\/v\d+\/|\/rest\/|\/graphql/i) ||
            method !== 'GET' || domain.includes('api')
        ) {
            if (isGraphQL) {
                websiteType = {
                    type: 'GraphQL API',
                    architecture: 'Schema-Based API',
                    color: '#d946ef', // Pink
                    icon: 'git-branch',
                    layout: 'hub-and-spoke',
                    components: [
                        'graphql-server',
                        'schema-registry',
                        'resolver-functions',
                        'data-sources',
                        'authentication-service'
                    ]
                };
            } else {
                websiteType = {
                    type: 'REST API',
                    architecture: 'Microservices',
                    color: '#ef4444', // Red
                    icon: 'server',
                    layout: 'microservices',
                    components: [
                        'api-gateway',
                        'service-registry',
                        'authentication-service',
                        'business-logic',
                        'data-service'
                    ]
                };
            }
        }
        // Single page application detection
        else if (
            headers['X-Powered-By']?.includes('React') ||
            headers['X-Powered-By']?.includes('Vue') ||
            headers['X-Powered-By']?.includes('Angular') ||
            path === '/' || path === '/index.html'
        ) {
            websiteType = {
                type: 'Single Page App',
                architecture: 'Frontend Framework',
                color: '#8b5cf6', // Violet
                icon: 'layout',
                layout: 'frontend-heavy',
                components: [
                    'ui-components',
                    'state-management',
                    'api-client',
                    'router',
                    'authentication-module'
                ]
            };
        }
        // Static site detection
        else if (
            path.match(/\.(html|htm|txt|md|css|js)$/i) ||
            (!path.includes('.') && method === 'GET')
        ) {
            websiteType = {
                type: 'Static Site',
                architecture: 'JAMstack',
                color: '#4b5563', // Gray
                icon: 'file',
                layout: 'static',
                components: [
                    'static-hosting',
                    'cdn-edge',
                    'asset-optimization'
                ]
            };
        }

        return websiteType;
    }

    /**
     * Detect database type based on path and request body
     */
    static detectDatabaseType(path, body) {
        // Default database info
        let dbInfo = {
            name: 'Database',
            type: 'SQL',
            icon: 'database'
        };

        // Check path for clues about database type
        if (path.includes('document') || path.includes('doc') || path.includes('mongo')) {
            dbInfo = {
                name: 'MongoDB',
                type: 'NoSQL',
                icon: 'database',
                color: '#10b981'
            };
        } else if (path.includes('graph')) {
            dbInfo = {
                name: 'Graph DB',
                type: 'Graph',
                icon: 'share-2',
                color: '#8b5cf6'
            };
        } else if (path.includes('key') || path.includes('cache') || path.includes('redis')) {
            dbInfo = {
                name: 'Redis',
                type: 'Key-Value',
                icon: 'box',
                color: '#ef4444'
            };
        } else if (path.includes('elastic') || path.includes('search')) {
            dbInfo = {
                name: 'Elasticsearch',
                type: 'Search',
                icon: 'search',
                color: '#f59e0b'
            };
        } else if (path.match(/postgres|pg|sql/i)) {
            dbInfo = {
                name: 'PostgreSQL',
                type: 'SQL',
                icon: 'database',
                color: '#3b82f6'
            };
        } else if (path.match(/mysql|maria/i)) {
            dbInfo = {
                name: 'MySQL',
                type: 'SQL',
                icon: 'database',
                color: '#0ea5e9'
            };
        } else if (body) {
            // Analyze body content for clues if available
            const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
            if (bodyStr.includes('aggregate') || bodyStr.includes('$match') || bodyStr.includes('$set')) {
                dbInfo = {
                    name: 'MongoDB',
                    type: 'NoSQL',
                    icon: 'database',
                    color: '#10b981'
                };
            } else if (bodyStr.includes('SELECT') || bodyStr.includes('INSERT INTO') || bodyStr.includes('UPDATE')) {
                dbInfo = {
                    name: 'SQL Database',
                    type: 'SQL',
                    icon: 'database',
                    color: '#3b82f6'
                };
            } else if (bodyStr.includes('query') && (bodyStr.includes('filter') || bodyStr.includes('sort'))) {
                dbInfo = {
                    name: 'Document DB',
                    type: 'NoSQL',
                    icon: 'file-text',
                    color: '#f59e0b'
                };
            }
        }

        return dbInfo;
    }

    /**
     * Detect cache type from headers
     */
    static detectCacheType(headers) {
        const cacheControl = headers['Cache-Control'] || headers['cache-control'] || '';
        const etag = headers['ETag'] || headers['etag'];
        const xCache = headers['X-Cache'] || headers['x-cache'] || '';
        const cacheStatus = headers['CF-Cache-Status'] || headers['cf-cache-status'] || '';

        let cacheInfo = {
            name: 'Cache',
            type: 'Generic',
            color: '#f59e0b',
            icon: 'hard-drive'
        };

        if (cacheControl.includes('no-cache') || cacheControl.includes('no-store')) {
            cacheInfo = {
                name: 'No Cache',
                type: 'Disabled',
                color: '#ef4444',
                icon: 'slash'
            };
        } else if (etag) {
            cacheInfo = {
                name: 'ETag Cache',
                type: 'Validation',
                color: '#0ea5e9',
                icon: 'tag'
            };
        } else if (cacheControl.includes('max-age')) {
            cacheInfo = {
                name: 'Time-Based Cache',
                type: 'Expiration',
                color: '#10b981',
                icon: 'clock'
            };
        } else if (xCache.includes('HIT') || cacheStatus.includes('HIT')) {
            cacheInfo = {
                name: 'CDN Cache',
                type: 'Edge',
                color: '#8b5cf6',
                icon: 'cloud'
            };
        } else if (headers['X-Varnish'] || headers['x-varnish']) {
            cacheInfo = {
                name: 'Varnish Cache',
                type: 'HTTP Accelerator',
                color: '#3b82f6',
                icon: 'zap'
            };
        } else if (headers['X-Cache-Lookup'] || headers['x-cache-lookup']) {
            cacheInfo = {
                name: 'Proxy Cache',
                type: 'Lookup',
                color: '#6366f1',
                icon: 'box'
            };
        }

        return cacheInfo;
    }

    /**
     * Detect backend technologies from request details
     */
    static detectBackendTechnology(path, headers) {
        let backend = {
            name: 'Backend Server',
            type: 'Generic',
            color: '#6b7280',
            icon: 'server'
        };

        // Check headers for technology clues
        const serverHeader = headers['Server'] || headers['server'] || '';
        const poweredBy = headers['X-Powered-By'] || headers['x-powered-by'] || '';

        if (serverHeader.includes('nginx') || poweredBy.includes('nginx')) {
            backend = {
                name: 'Nginx',
                type: 'Web Server',
                color: '#22c55e',
                icon: 'server'
            };
        } else if (serverHeader.includes('Apache') || poweredBy.includes('Apache')) {
            backend = {
                name: 'Apache',
                type: 'Web Server',
                color: '#ef4444',
                icon: 'server'
            };
        } else if (poweredBy.includes('PHP')) {
            backend = {
                name: 'PHP',
                type: 'Application Server',
                color: '#6366f1',
                icon: 'code'
            };
        } else if (poweredBy.includes('Express') || poweredBy.includes('Node')) {
            backend = {
                name: 'Node.js',
                type: 'JavaScript Runtime',
                color: '#14b8a6',
                icon: 'code'
            };
        } else if (poweredBy.includes('ASP.NET') || poweredBy.includes('IIS')) {
            backend = {
                name: 'ASP.NET',
                type: '.NET Application',
                color: '#0ea5e9',
                icon: 'code'
            };
        } else if (poweredBy.includes('Django') || poweredBy.includes('Python')) {
            backend = {
                name: 'Python',
                type: 'Application Server',
                color: '#facc15',
                icon: 'code'
            };
        } else if (poweredBy.includes('Ruby') || poweredBy.includes('Rails')) {
            backend = {
                name: 'Ruby on Rails',
                type: 'Application Server',
                color: '#ef4444',
                icon: 'code'
            };
        } else if (serverHeader.includes('cloudflare')) {
            backend = {
                name: 'Cloudflare',
                type: 'CDN/Edge',
                color: '#f97316',
                icon: 'cloud'
            };
        } else if (serverHeader.includes('AWS') || serverHeader.includes('Amazon') ||
            headers['X-Amz-'] || Object.keys(headers).some(h => h.startsWith('X-Amz-'))) {
            backend = {
                name: 'AWS',
                type: 'Cloud Platform',
                color: '#f97316',
                icon: 'cloud'
            };
        } else if (poweredBy.includes('Spring') || path.includes('actuator')) {
            backend = {
                name: 'Spring Boot',
                type: 'Java Framework',
                color: '#22c55e',
                icon: 'code'
            };
        }

        // Check path patterns for technology clues
        if (path.match(/\.php$/i)) {
            backend = {
                name: 'PHP',
                type: 'Application Server',
                color: '#6366f1',
                icon: 'code'
            };
        } else if (path.match(/\.aspx?$/i)) {
            backend = {
                name: 'ASP.NET',
                type: '.NET Application',
                color: '#0ea5e9',
                icon: 'code'
            };
        } else if (path.match(/\.jsp$/i) || path.match(/\.do$/i)) {
            backend = {
                name: 'Java Servlet',
                type: 'Java Application',
                color: '#ef4444',
                icon: 'coffee'
            };
        } else if (path.match(/\.py$/i)) {
            backend = {
                name: 'Python',
                type: 'Application Server',
                color: '#facc15',
                icon: 'code'
            };
        } else if (path.match(/\.rb$/i)) {
            backend = {
                name: 'Ruby',
                type: 'Application Server',
                color: '#ef4444',
                icon: 'code'
            };
        } else if (path.match(/wp-(admin|content|includes)/i)) {
            backend = {
                name: 'WordPress',
                type: 'CMS',
                color: '#0284c7',
                icon: 'edit'
            };
        } else if (path.includes('drupal')) {
            backend = {
                name: 'Drupal',
                type: 'CMS',
                color: '#0ea5e9',
                icon: 'edit'
            };
        } else if (path.includes('joomla')) {
            backend = {
                name: 'Joomla',
                type: 'CMS',
                color: '#f97316',
                icon: 'edit'
            };
        } else if (path.includes('magento') || path.includes('catalog')) {
            backend = {
                name: 'Magento',
                type: 'E-commerce',
                color: '#ef4444',
                icon: 'shopping-bag'
            };
        } else if (path.includes('shopify')) {
            backend = {
                name: 'Shopify',
                type: 'E-commerce',
                color: '#22c55e',
                icon: 'shopping-bag'
            };
        }

        return backend;
    }

    /**
     * Create real-time application network mapping
     */
    static async createApplicationNetworkMap(containerId, applications, connections, options = {}) {
        const networkNodes = applications.map(app => ({
            id: app.id,
            label: app.name,
            type: app.type || 'application',
            data: {
                ...app,
                status: app.status || 'active',
                latency: app.latency || 0,
                throughput: app.throughput || 0,
                errorRate: app.errorRate || 0
            }
        }));

        const networkEdges = connections.map(conn => ({
            id: `${conn.source}-${conn.target}`,
            source: conn.source,
            target: conn.target,
            label: conn.protocol || 'HTTP',
            type: conn.type || 'http',
            data: {
                ...conn,
                bandwidth: conn.bandwidth || 100,
                latency: conn.latency || 0
            }
        }));

        return await this.createApiFlowDiagram(containerId, networkNodes, networkEdges, {
            ...options,
            layout: {
                name: 'cose',
                idealEdgeLength: 100,
                nodeOverlap: 20,
                refresh: 20,
                fit: true,
                padding: 30,
                randomize: false,
                componentSpacing: 100,
                nodeRepulsion: 400000,
                edgeElasticity: 100,
                nestingFactor: 5,
                gravity: 80,
                numIter: 1000,
                initialTemp: 200,
                coolingFactor: 0.95,
                minTemp: 1.0
            }
        });
    }

    /**
     * Create API-led connectivity visualization
     */
    static async createApiLedConnectivityMap(containerId, layers, options = {}) {
        const layerHeight = 150;

        const layeredNodes = [];
        const layeredEdges = [];

        // Create system layer (bottom)
        const systemLayer = layers.system || [];
        systemLayer.forEach((api, index) => {
            layeredNodes.push({
                id: `system-${api.id}`,
                label: api.name,
                type: 'system',
                position: { x: index * 200, y: 0 },
                data: { ...api, layer: 'system' }
            });
        });

        // Create process layer (middle)
        const processLayer = layers.process || [];
        processLayer.forEach((api, index) => {
            layeredNodes.push({
                id: `process-${api.id}`,
                label: api.name,
                type: 'process',
                position: { x: index * 200, y: layerHeight },
                data: { ...api, layer: 'process' }
            });
        });

        // Create experience layer (top)
        const experienceLayer = layers.experience || [];
        experienceLayer.forEach((api, index) => {
            layeredNodes.push({
                id: `experience-${api.id}`,
                label: api.name,
                type: 'experience',
                position: { x: index * 200, y: layerHeight * 2 },
                data: { ...api, layer: 'experience' }
            });
        });

        // Create connections between layers
        const connections = options.connections || [];
        connections.forEach(conn => {
            layeredEdges.push({
                id: `${conn.source}-${conn.target}`,
                source: conn.source,
                target: conn.target,
                label: conn.operation || 'API Call',
                type: 'api-call',
                data: conn
            });
        });

        return await this.createApiFlowDiagram(containerId, layeredNodes, layeredEdges, {
            ...options,
            layout: {
                name: 'preset',
                positions: layeredNodes.reduce((acc, node) => {
                    acc[node.id] = node.position;
                    return acc;
                }, {})
            }
        });
    }

    /**
     * Load flow templates
     */
    static loadFlowTemplates() {
        this.flowTemplates.set('microservices', {
            name: 'Microservices Architecture',
            description: 'Template for microservices communication patterns',
            nodes: [
                { id: 'gateway', label: 'API Gateway', type: 'gateway' },
                { id: 'auth', label: 'Auth Service', type: 'service' },
                { id: 'user', label: 'User Service', type: 'service' },
                { id: 'order', label: 'Order Service', type: 'service' },
                { id: 'db', label: 'Database', type: 'database' }
            ],
            edges: [
                { source: 'gateway', target: 'auth', label: 'Authenticate' },
                { source: 'gateway', target: 'user', label: 'User API' },
                { source: 'gateway', target: 'order', label: 'Order API' },
                { source: 'user', target: 'db', label: 'Query' },
                { source: 'order', target: 'db', label: 'Query' }
            ]
        });

        this.flowTemplates.set('api-led', {
            name: 'API-Led Connectivity',
            description: 'MuleSoft-style three-layer architecture',
            layers: {
                experience: [
                    { id: 'mobile', name: 'Mobile App', type: 'client' },
                    { id: 'web', name: 'Web App', type: 'client' }
                ],
                process: [
                    { id: 'customer', name: 'Customer API', type: 'process' },
                    { id: 'order', name: 'Order API', type: 'process' }
                ],
                system: [
                    { id: 'crm', name: 'CRM System', type: 'system' },
                    { id: 'erp', name: 'ERP System', type: 'system' }
                ]
            }
        });

        this.flowTemplates.set('e-commerce', {
            name: 'E-Commerce Architecture',
            description: 'Template for e-commerce applications',
            nodes: [
                { id: 'frontend', label: 'Frontend', type: 'service' },
                { id: 'api', label: 'API Gateway', type: 'gateway' },
                { id: 'cart', label: 'Cart Service', type: 'service' },
                { id: 'product', label: 'Product Catalog', type: 'service' },
                { id: 'payment', label: 'Payment Service', type: 'service' },
                { id: 'db', label: 'Database', type: 'database' },
                { id: 'cache', label: 'Cache', type: 'service' }
            ],
            edges: [
                { source: 'frontend', target: 'api', label: 'Request' },
                { source: 'api', target: 'cart', label: 'Cart API' },
                { source: 'api', target: 'product', label: 'Product API' },
                { source: 'cart', target: 'payment', label: 'Process' },
                { source: 'cart', target: 'db', label: 'Store' },
                { source: 'product', target: 'db', label: 'Query' },
                { source: 'product', target: 'cache', label: 'Cache' }
            ]
        });
    }

    /**
     * Select a random pattern from array based on frequency
     * @param {Array} patterns - Array of patterns with frequency property
     * @returns {Object} Selected pattern
     */
    static selectRandomPatternByFrequency(patterns) {
        if (!patterns || patterns.length === 0) {
            return null;
        }

        // Handle single pattern case
        if (patterns.length === 1) {
            return patterns[0];
        }

        // Weight patterns by frequency
        const weightedPatterns = patterns.map(pattern => {
            let weight = 1; // Default weight

            switch (pattern.frequency) {
                case 'high':
                    weight = 10;
                    break;
                case 'medium':
                    weight = 5;
                    break;
                case 'low':
                    weight = 1;
                    break;
                default:
                    weight = 1;
                    break;
            }

            return { pattern, weight };
        });

        // Calculate total weight
        const totalWeight = weightedPatterns.reduce((sum, item) => sum + item.weight, 0);

        // Get random value between 0 and total weight
        const randomValue = Math.random() * totalWeight;

        // Find pattern based on weighted selection
        let cumulativeWeight = 0;
        for (const { pattern, weight } of weightedPatterns) {
            cumulativeWeight += weight;
            if (randomValue <= cumulativeWeight) {
                return pattern;
            }
        }

        // Fallback to first pattern if selection fails
        return patterns[0];
    }

    /**
     * Animate edges in the flow diagram to simulate traffic
     * @param {Object} cy - Cytoscape instance
     * @param {Array} edges - Array of edges to animate
     */
    static animateFlowDiagram(cy, edges) {
        if (!cy || !edges || edges.length === 0) return;

        // Add CSS class for animation
        cy.style().selector('edge.traffic-pulse')
            .style('line-color', '#16a34a')
            .style('target-arrow-color', '#16a34a')
            .style('width', 6)
            .style('opacity', 0.9)
            .style('transition-property', 'width, opacity, line-color, target-arrow-color')
            .style('transition-duration', '0.3s')
            .style('transition-timing-function', 'cubic-bezier(0.4, 0, 0.2, 1)');

        // Animate each edge
        edges.forEach(edge => {
            const cyEdge = cy.getElementById(edge.id);
            if (cyEdge) {
                cyEdge.addClass('traffic-pulse');

                // Remove animation class after delay
                setTimeout(() => {
                    if (!cyEdge.removed()) {
                        cyEdge.removeClass('traffic-pulse');
                    }
                }, 1000);
            }
        });
    }

    /**
     * Analyze network and create traffic patterns based on graph structure
     * @param {Object} cy - Cytoscape instance
     * @returns {Array} Array of traffic patterns
     */
    static analyzeNetworkTraffic(cy) {
        const patterns = [];

        if (!cy) return patterns;

        try {
            // Get all node types in the graph
            const nodeTypes = new Set();
            cy.nodes().forEach(node => {
                const nodeType = node.data('type');
                if (nodeType) nodeTypes.add(nodeType);
            });

            // Get all edge types in the graph
            const edgeTypes = new Set();
            cy.edges().forEach(edge => {
                const edgeType = edge.data('type');
                if (edgeType) edgeTypes.add(edgeType);
            });

            // Base traffic patterns for common node type pairs
            const basePatterns = [
                {
                    sourceType: 'service',
                    targetType: 'gateway',
                    color: '#10b981',
                    speed: 800,
                    dataSize: 8,
                    frequency: 'high',
                    edgeType: 'http'
                },
                {
                    sourceType: 'gateway',
                    targetType: 'endpoint',
                    color: '#3b82f6',
                    speed: 700,
                    dataSize: 10,
                    frequency: 'high',
                    edgeType: 'http'
                },
                {
                    sourceType: 'endpoint',
                    targetType: 'database',
                    color: '#8b5cf6',
                    speed: 1000,
                    dataSize: 12,
                    frequency: 'medium',
                    edgeType: 'database'
                },
                {
                    sourceType: 'endpoint',
                    targetType: 'service',
                    color: '#f59e0b',
                    speed: 500,
                    dataSize: 8,
                    frequency: 'low',
                    edgeType: 'http'
                },
                {
                    sourceType: 'gateway',
                    targetType: 'service',
                    color: '#ef4444',
                    speed: 600,
                    dataSize: 6,
                    frequency: 'medium',
                    edgeType: 'auth'
                },
                {
                    sourceType: 'service',
                    targetType: 'service',
                    color: '#10b981',
                    speed: 400,
                    dataSize: 8,
                    frequency: 'high',
                    edgeType: 'http'
                }
            ];

            // Add patterns that exist in the current graph
            basePatterns.forEach(pattern => {
                // Check if this pattern matches nodes in the graph
                const hasSourceType = nodeTypes.has(pattern.sourceType);
                const hasTargetType = nodeTypes.has(pattern.targetType);

                if (hasSourceType && hasTargetType) {
                    // Check if there's at least one edge of this type
                    const hasMatchingEdges = pattern.edgeType ?
                        edgeTypes.has(pattern.edgeType) : true;

                    if (hasMatchingEdges) {
                        patterns.push(pattern);
                    }
                }
            });

            // If no patterns were found, add a generic one
            if (patterns.length === 0 && cy.nodes().length > 1) {
                patterns.push({
                    sourceType: cy.nodes().first().data('type') || 'service',
                    targetType: cy.nodes().last().data('type') || 'service',
                    color: '#8b92a5',
                    speed: 800,
                    dataSize: 8,
                    frequency: 'medium'
                });
            }
        } catch (error) {
            console.error('Error analyzing network traffic:', error);
            // Add a fallback pattern
            patterns.push({
                sourceType: 'service',
                targetType: 'service',
                color: '#10b981',
                speed: 800,
                dataSize: 8,
                frequency: 'medium'
            });
        }

        return patterns;
    }

    /**
     * Add real-time updates to flow diagram
     */
    static addRealtimeUpdates(cy) {
        if (!cy) return;

        // Clear any existing update intervals for this instance
        if (cy.data('updateIntervalId')) {
            clearInterval(cy.data('updateIntervalId'));
        }

        // Create traffic patterns based on node types and website/API type
        const trafficPatterns = this.analyzeNetworkTraffic(cy);

        // Calculate interval time with variance
        // Calculate a dynamic interval based on graph complexity
        const baseInterval = 1500; // Base interval 1.5s
        const variance = 800; // Up to +/- 800ms variance
        const intervalTime = baseInterval + (Math.random() * variance - variance / 2);

        // Set up intervals for different types of traffic with dynamic timing
        const updateIntervalId = setInterval(() => {
            // Choose a random traffic pattern
            if (trafficPatterns.length === 0) return;

            // Make frequency-weighted random selection
            const pattern = this.selectRandomPatternByFrequency(trafficPatterns);

            // Find edges that match this pattern
            const matchingEdges = cy.edges().filter(edge => {
                const source = edge.source();
                const target = edge.target();

                // Skip edges already being animated
                if (edge.hasClass('traffic-pulse')) return false;

                // Match by type
                const typeMatch = (source.data('type') === pattern.sourceType &&
                    target.data('type') === pattern.targetType);

                // Also consider edge type if specified in pattern
                if (pattern.edgeType && edge.data('type') !== pattern.edgeType) {
                    return false;
                }

                return typeMatch;
            });

            if (matchingEdges.length > 0) {
                // Select a random edge from matching ones
                const edgeToAnimate = matchingEdges[Math.floor(Math.random() * matchingEdges.length)];

                // Add a class for CSS animation
                edgeToAnimate.addClass('traffic-pulse');

                // Remove the class after animation completes
                setTimeout(() => {
                    if (edgeToAnimate && !edgeToAnimate.removed()) {
                        edgeToAnimate.removeClass('traffic-pulse');
                    }
                }, pattern.speed);
            }
        }, intervalTime);

        // Store interval ID for cleanup
        cy.data('updateIntervalId', updateIntervalId);
    }

    /**
     * Clean up flow animations
     */
    static cleanupFlowAnimations(containerId) {
        // Get the instance
        const instance = this.instances.get(containerId);
        if (!instance) return;

        // Clear any update intervals
        if (instance.data('updateIntervalId')) {
            clearInterval(instance.data('updateIntervalId'));
            instance.removeData('updateIntervalId');
        }

        // Clear any animation frames
        if (instance.data('animationFrameId')) {
            cancelAnimationFrame(instance.data('animationFrameId'));
            instance.removeData('animationFrameId');
        }

        // Remove all animation elements
        const container = instance.container();
        if (container) {
            // Find and remove any animation packets
            try {
                const animElements = container.querySelectorAll('.data-packet');
                animElements.forEach(el => {
                    if (el && el.parentNode) {
                        try {
                            el.parentNode.removeChild(el);
                        } catch (e) {
                            // Ignore removal errors
                            console.log('Error removing animation element:', e);
                        }
                    }
                });

                // Also check for any orphaned animation elements in the document body
                document.querySelectorAll('.data-packet').forEach(el => {
                    if (el && el.parentNode) {
                        try {
                            el.parentNode.removeChild(el);
                        } catch (e) {
                            console.log('Error removing orphaned animation element:', e);
                        }
                    }
                });
            } catch (e) {
                console.error('Error during animation cleanup:', e);
            }
        }

        // Remove highlight classes from edges
        try {
            instance.edges().removeClass('highlighted traffic-pulse');
        } catch (e) {
            console.log('Error removing edge classes:', e);
        }
    }

    /**
     * Add event listeners and interactions to the Cytoscape instance
     */
    static addFlowInteractions(cy) {
        if (!cy) return;

        // Add click event to nodes
        cy.on('tap', 'node', function (event) {
            const node = event.target;
            console.log('Node clicked:', node.data());
        });

        // Add click event to edges
        cy.on('tap', 'edge', function (event) {
            const edge = event.target;
            console.log('Edge clicked:', edge.data());
        });

        // Add hover effects
        cy.on('mouseover', 'node', function (event) {
            const node = event.target;
            node.style('border-width', 4);
            node.style('border-color', '#ff6c37');
        });

        cy.on('mouseout', 'node', function (event) {
            const node = event.target;
            node.style('border-width', 2);
            node.style('border-color', '#333333');
        });
    }
}

export default NetworkFlowService;
