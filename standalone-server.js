// standalone-server.js - Server without database dependency
console.log('🚀 Starting standalone server (no DB)...');

const express = require('express');
const cors = require('cors');

const app = express();
const port = 5003;

// Middleware
app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true
}));
app.use(express.json());

// Simple auth middleware
const simpleAuth = (req, res, next) => {
    req.user = { id: 'test-user', _id: 'test-user' };
    next();
};

// Visual Designer Routes
const visualDesignerRouter = express.Router();

// In-memory storage for testing
const designStorage = new Map();

visualDesignerRouter.post('/designs', simpleAuth, (req, res) => {
    try {
        console.log('📝 Save request received');
        const { collectionId, designerState, openApiSpec, name } = req.body;

        if (!collectionId) {
            return res.status(400).json({
                success: false,
                message: 'Collection ID is required'
            });
        }

        // Store in memory
        const designId = `${collectionId}-${req.user.id}`;
        designStorage.set(designId, {
            collectionId,
            userId: req.user.id,
            designerState: designerState || { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } },
            openApiSpec,
            name: name || 'Visual Design',
            lastUpdated: new Date()
        });

        console.log(`✅ Design saved for collection ${collectionId}`);
        console.log(`   Nodes: ${designerState?.nodes?.length || 0}`);
        console.log(`   Edges: ${designerState?.edges?.length || 0}`);

        res.json({
            success: true,
            message: 'Design saved successfully',
            data: {
                id: designId,
                nodeCount: designerState?.nodes?.length || 0,
                edgeCount: designerState?.edges?.length || 0,
                lastUpdated: new Date()
            }
        });
    } catch (error) {
        console.error('❌ Save error:', error);
        res.status(500).json({
            success: false,
            message: 'Error saving design',
            error: error.message
        });
    }
});

visualDesignerRouter.get('/designs/:collectionId', simpleAuth, (req, res) => {
    try {
        console.log('📖 Load request received');
        const { collectionId } = req.params;

        // Get from memory
        const designId = `${collectionId}-${req.user.id}`;
        const storedDesign = designStorage.get(designId);

        if (storedDesign) {
            console.log(`✅ Design loaded for collection ${collectionId}`);
            console.log(`   Nodes: ${storedDesign.designerState?.nodes?.length || 0}`);

            res.json({
                success: true,
                data: {
                    designerState: storedDesign.designerState,
                    openApiSpec: storedDesign.openApiSpec,
                    lastUpdated: storedDesign.lastUpdated,
                    name: storedDesign.name,
                    description: 'Visual API design'
                }
            });
        } else {
            console.log(`📄 No design found for collection ${collectionId}, returning empty`);
            res.json({
                success: true,
                data: {
                    designerState: {
                        nodes: [],
                        edges: [],
                        viewport: { x: 0, y: 0, zoom: 1 }
                    },
                    openApiSpec: null,
                    lastUpdated: null,
                    name: 'Visual Design',
                    description: 'Visual API design'
                }
            });
        }
    } catch (error) {
        console.error('❌ Load error:', error);
        res.status(500).json({
            success: false,
            message: 'Error loading design',
            error: error.message
        });
    }
});

visualDesignerRouter.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'visual-designer-standalone',
        timestamp: new Date(),
        storage: `${designStorage.size} designs in memory`
    });
});

// Register routes
app.use('/api/visual-designer', visualDesignerRouter);

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        server: 'standalone',
        timestamp: new Date()
    });
});

// Start server
app.listen(port, () => {
    console.log(`✅ Standalone server running on port ${port}`);
    console.log(`🌐 Visual Designer API: http://localhost:${port}/api/visual-designer`);
    console.log(`💚 Health check: http://localhost:${port}/api/health`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Shutting down standalone server...');
    process.exit(0);
});
