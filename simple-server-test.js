// simple-server-test.js
console.log('🚀 Starting simple server test...');

try {
    console.log('1. Loading express...');
    const express = require('express');
    console.log('✅ Express loaded');

    console.log('2. Creating app...');
    const app = express();
    console.log('✅ App created');

    console.log('3. Adding middleware...');
    app.use(express.json());
    console.log('✅ Middleware added');

    console.log('4. Loading simple routes...');
    const visualDesignerRoutes = require('./routes/visualDesigner_simple');
    console.log('✅ Routes loaded');

    console.log('5. Registering routes...');
    app.use('/api/visual-designer', visualDesignerRoutes);
    console.log('✅ Routes registered');

    console.log('6. Starting server...');
    const server = app.listen(5002, () => {
        console.log('✅ Server started on port 5002');
        console.log('🌟 Simple server test successful!');

        // Test the routes
        setTimeout(() => {
            console.log('🧪 Testing routes...');
            const http = require('http');

            const options = {
                hostname: 'localhost',
                port: 5002,
                path: '/api/visual-designer/health',
                method: 'GET'
            };

            const req = http.request(options, (res) => {
                console.log(`Health check status: ${res.statusCode}`);
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    console.log('Health check response:', data);
                    server.close();
                    process.exit(0);
                });
            });

            req.on('error', (err) => {
                console.error('Health check failed:', err.message);
                server.close();
                process.exit(1);
            });

            req.end();
        }, 1000);
    });

    server.on('error', (err) => {
        console.error('❌ Server error:', err.message);
        process.exit(1);
    });

} catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
}
