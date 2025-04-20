/**
 * Mock API server for CI/CD testing of Pigeon
 * This server runs on a different port than the main application
 * and provides endpoints for testing environment variable handling
 */

const express = require('express');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3500; // Use a different default port

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Log all incoming requests
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    console.log('Headers:', JSON.stringify(req.headers));
    next();
});

// Test endpoints for environment variable handling
app.get('/api/users', (req, res) => {
    res.json({
        success: true,
        message: 'Users endpoint accessed successfully',
        receivedQuery: req.query,
        receivedHeaders: {
            authorization: req.headers.authorization,
            'x-custom-header': req.headers['x-custom-header']
        }
    });
});

app.get('/api/users/:userId', (req, res) => {
    res.json({
        success: true,
        userId: req.params.userId,
        message: `User ${req.params.userId} retrieved successfully`,
        receivedQuery: req.query
    });
});

app.get('/api/check', (req, res) => {
    // Endpoint to test dynamic variables set in pre-request scripts
    res.json({
        success: true,
        dynamicHeaderReceived: !!req.headers['x-dynamic-header'],
        dynamicHeaderValue: req.headers['x-dynamic-header'],
        message: 'Check endpoint accessed successfully'
    });
});

app.post('/api/items', (req, res) => {
    // Create item endpoint
    res.status(201).json({
        id: `item-${Date.now()}`,
        ...req.body,
        created: new Date().toISOString()
    });
});

app.delete('/api/items/:itemId', (req, res) => {
    // Delete item endpoint
    res.status(204).send();
});

// Start the server
app.listen(port, () => {
    console.log(`Mock API server for CI/CD testing running on port ${port}`);
    console.log(`Test endpoints available at http://localhost:${port}/api/*`);
});