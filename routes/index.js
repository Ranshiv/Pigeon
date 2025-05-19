// routes/index.js
const express = require('express');
const router = express.Router();

// Import all route modules
const authRoutes = require('./auth');
const collectionsRoutes = require('./collections');
const workspacesRoutes = require('./workspaces');
const requestsRoutes = require('./requests');
const historyRoutes = require('./history');
const documentationRoutes = require('./documentation');

// Register routes with their base paths
router.use('/auth', authRoutes);
router.use('/collections', collectionsRoutes);
router.use('/workspaces', workspacesRoutes);
router.use('/requests', requestsRoutes);
router.use('/history', historyRoutes);
router.use('/documentation', documentationRoutes);

module.exports = router;