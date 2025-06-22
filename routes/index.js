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

// Register routes with their base paths
router.use('/auth', authRoutes);
router.use('/collections', collectionsRoutes);
router.use('/environments', environmentsRoutes);
router.use('/workspaces', workspacesRoutes);
router.use('/requests', requestsRoutes);
router.use('/history', historyRoutes);
router.use('/documentation', documentationRoutes);
router.use('/monitoring', monitoringRoutes);

module.exports = router;