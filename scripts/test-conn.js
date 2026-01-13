const mongoose = require('mongoose');
require('dotenv').config();

console.log('Starting connection test...');
console.log('URI:', process.env.DATABASE_URL.substring(0, 20) + '...');

mongoose.connect(process.env.DATABASE_URL)
    .then(() => {
        console.log('SUCCESS: Connected to MongoDB');
        process.exit(0);
    })
    .catch(err => {
        console.error('FAILURE: Could not connect:', err.message);
        process.exit(1);
    });

// Force exit after 10 seconds
setTimeout(() => {
    console.log('TIMEOUT: Connection took too long');
    process.exit(1);
}, 10000);
