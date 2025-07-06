// routes/index.js
const express = require('express');
const router = express.Router();

// Import all route modules
const authRoutes = require('./auth');
const collectionsRoutes = require('./collections');
const environmentsRoutes = require('./environments');
const workspacesRoutes = require('./workspaces');
const requestsRoutes = require('./requests');
const historyRoutes = require('./history');
const documentationRoutes = require('./documentation');
const monitoringRoutes = require('./monitoring');

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

// Register routes with their base paths
router.use('/auth', authRoutes);
router.use('/collections', collectionsRoutes);
router.use('/environments', environmentsRoutes);
router.use('/workspaces', workspacesRoutes);
router.use('/requests', requestsRoutes);
router.use('/history', historyRoutes);
router.use('/documentation', documentationRoutes);
router.use('/monitoring', monitoringRoutes);

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

module.exports = router;