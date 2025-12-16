// config/db.js
const mongoose = require('mongoose');
const { MongoClient } = require('mongodb');

// MongoDB connection URI and DB name
// Prefer explicit MONGODB_URI, but fall back to DATABASE_URL (used by this repo)
// so the native driver doesn't try (and fail) to connect to localhost.
const mongoURI = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017';
const dbName = process.env.DB_NAME || 'pigeon_db';

// Create MongoDB client for native driver operations
const client = new MongoClient(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// Database reference
let db;

// Connect to MongoDB using native driver
async function connectToDatabase() {
    try {
        await client.connect();
        console.log('Connected to MongoDB using native driver');
        db = client.db(dbName);

        // Ensure indexes for better performance
        await db.collection('workspaces').createIndex({ owner: 1 });
        await db.collection('collections').createIndex({ workspaceId: 1 });
        await db.collection('collections').createIndex({ owner: 1 });

        return db;
    } catch (err) {
        console.error('Failed to connect to MongoDB:', err);
        throw err;
    }
}

// Connect to MongoDB using mongoose for schema-based operations
async function connectMongoose() {
    try {
        await mongoose.connect(process.env.DATABASE_URL || mongoURI);
        console.log('Connected to MongoDB using Mongoose');
    } catch (err) {
        console.error('Could not connect to MongoDB using Mongoose', err);
        throw err;
    }
}

// Initialize both connections
async function initializeConnections() {
    // Mongoose is required for the majority of route handlers (models/)
    // so connect it first.
    await connectMongoose();

    // Native driver is used for some operations; treat it as best-effort in dev.
    try {
        await connectToDatabase();
    } catch (err) {
        console.warn('Native MongoDB client connection failed; continuing with Mongoose only:', err?.message || err);
    }
}

module.exports = {
    connectToDatabase,
    connectMongoose,
    initializeConnections,
    getDb: () => {
        if (db) return db;
        // In tests, routes may rely on a Mongoose-only connection (e.g. mongodb-memory-server).
        if (mongoose.connection && mongoose.connection.readyState === 1 && mongoose.connection.db) {
            return mongoose.connection.db;
        }
        return null;
    },
    client
};