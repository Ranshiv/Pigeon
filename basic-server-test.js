// Basic server test without DB
const express = require('express');
const app = express();

app.get('/test', (req, res) => {
    res.json({ message: 'Server is working' });
});

const port = 5001;
app.listen(port, () => {
    console.log(`Test server running on port ${port}`);
});

// Keep process alive
process.on('SIGINT', () => {
    console.log('Received SIGINT, shutting down gracefully');
    process.exit(0);
});
