// routes/index.js
const express = require('express');
const router = express.Router();

// Import all route modules
const authRoutes = require('./auth');
const collectionsRoutes = require('./collections');
const environmentsRoutes = require('./environments');
const importsRoutes = require('./imports');
const workspacesRoutes = require('./workspaces');
const requestsRoutes = require('./requests');
const historyRoutes = require('./history');
const documentationRoutes = require('./documentation');
const monitoringRoutes = require('./monitoring');
const mergeRequestsRoutes = require('./mergeRequests');

// Import Performance Testing routes
const performanceTestingRoutes = require('./performanceTesting');

// Import new advanced monitoring routes
const statusPagesRoutes = require('./statusPages');
const reportsRoutes = require('./reports');
const integrationsRoutes = require('./integrations');
const maintenanceRoutes = require('./maintenance');
const teamsRoutes = require('./teams');

// Import authentication and certificate management routes
const oauthRoutes = require('./oauth');
const certificatesRoutes = require('./certificates');

// Import API prototyping and versioning routes
const apiVersionsRoutes = require('./apiVersions');
const mockServersRoutes = require('./mockServers');

// Import Visual API Designer routes
const visualDesignerRoutes = require('./visualDesigner');

// Import Analytics routes
const analyticsRoutes = require('./analytics');

// Import GraphQL routes
const graphqlRoutes = require('./graphql');

// Import Compliance routes
const complianceRoutes = require('./compliance');

// Import Multi-Protocol routes
const protocolsRoutes = require('./protocols');

// Import API Marketplace routes
const apiMarketplaceRoutes = require('./apiMarketplace');

// Import Incident Management routes
const incidentsRoutes = require('./incidents');

// Import Alert routes
const alertsRoutes = require('./alerts');
const mcpRoutes = require('./mcp');
const mcpServerRoutes = require('./mcpServer');

// Register routes with their base paths
router.use('/auth', authRoutes);
router.use('/collections', collectionsRoutes);
router.use('/environments', environmentsRoutes);
router.use('/imports', importsRoutes);
router.use('/workspaces', workspacesRoutes);
router.use('/requests', requestsRoutes);
router.use('/history', historyRoutes);
router.use('/documentation', documentationRoutes);
router.use('/monitoring', monitoringRoutes);
router.use('/merge-requests', mergeRequestsRoutes);

// Performance testing & load generation
router.use('/performance-tests', performanceTestingRoutes);

// Register new advanced monitoring routes
router.use('/status-pages', statusPagesRoutes);
router.use('/reports', reportsRoutes);
router.use('/integrations', integrationsRoutes);
router.use('/maintenance', maintenanceRoutes);
router.use('/teams', teamsRoutes);

// Register authentication and certificate management routes
router.use('/oauth', oauthRoutes);
router.use('/certificates', certificatesRoutes);

// Register API prototyping and versioning routes
router.use('/api-versions', apiVersionsRoutes);
router.use('/mock-servers', mockServersRoutes);

// Register Visual API Designer routes
router.use('/visual-designer', visualDesignerRoutes);

// Register Analytics routes
router.use('/analytics', analyticsRoutes);

// Register GraphQL routes
router.use('/graphql', graphqlRoutes);

// Register Compliance routes
router.use('/compliance', complianceRoutes);

// Register Governance scorecard routes
router.use('/governance', require('./governance'));

// Register Consumer-Driven Contract Testing routes
router.use('/consumer-contracts', require('./consumerContracts'));

// Register OpenTelemetry Trace-to-Test routes
router.use('/traces', require('./traces'));

// Register Multi-Protocol routes (WebSocket, gRPC, SOAP, MQTT, SSE)
router.use('/protocols', protocolsRoutes);

// Register API Marketplace routes
router.use('/marketplace', apiMarketplaceRoutes);

// Register Incident Management routes
router.use('/incidents', incidentsRoutes);

// Register Alert routes
router.use('/alerts', alertsRoutes);
router.use('/mcp', mcpRoutes);
router.use('/mcp-server', mcpServerRoutes);

// Register Collaboration routes (Reviews & Comments & Activity)
router.use('/reviews', require('./reviews'));
router.use('/comments', require('./comments'));
router.use('/activities', require('./activities'));
router.use('/notifications', require('./notifications'));

module.exports = router;
