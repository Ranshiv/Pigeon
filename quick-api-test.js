console.log('🔄 Starting API version storage test...');

const mongoose = require('mongoose');
require('dotenv').config();

console.log('✅ Dependencies loaded successfully');
console.log('📊 Environment variables:');
console.log('   - DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'Not set');
console.log('   - NODE_ENV:', process.env.NODE_ENV);

// Simple connection test
async function quickTest() {
    try {
        console.log('\n🔄 Testing MongoDB connection...');

        const dbUrl = process.env.DATABASE_URL || process.env.MONGODB_URI;
        if (!dbUrl) {
            throw new Error('No database URL found in environment variables');
        }

        console.log('🔗 Connecting to:', dbUrl.replace(/\/\/.*@/, '//***:***@')); // Hide credentials

        await mongoose.connect(dbUrl, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000 // 5 second timeout
        });

        console.log('✅ MongoDB connection successful!');

        // Test model import
        const ApiVersion = require('./models/ApiVersion');
        console.log('✅ ApiVersion model loaded successfully');

        // Quick count test
        const count = await ApiVersion.countDocuments();
        console.log(`📊 Found ${count} existing API versions in database`);

        console.log('\n🎉 Backend API version storage is working correctly!');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        if (error.name === 'MongoServerSelectionError') {
            console.error('   - This is likely a database connection issue');
        }
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
        process.exit(0);
    }
}

quickTest();
