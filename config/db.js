// config/db.js
const mongoose = require('mongoose');
const { MongoClient } = require('mongodb');

// Fail fast when disconnected instead of buffering operations for 10s+.
mongoose.set('bufferCommands', false);

// MongoDB connection URI and DB name
// Prefer explicit MONGODB_URI, but fall back to DATABASE_URL (used by this repo)
// so the native driver doesn't try (and fail) to connect to localhost.
const rawMongoURI = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017';
const dbName = process.env.DB_NAME || 'pigeon_db';

function normalizeMongoUri(uri) {
    if (!uri || (!uri.startsWith('mongodb://') && !uri.startsWith('mongodb+srv://'))) {
        return uri;
    }

    try {
        const parsed = new URL(uri);
        const hasCredentials = parsed.username || parsed.password;
        if (!hasCredentials) {
            return uri;
        }

        const decodedUser = decodeURIComponent(parsed.username || '');
        const decodedPassword = decodeURIComponent(parsed.password || '');

        // Re-encode to ensure special characters (e.g. @, :, /, #) are URL-safe.
        parsed.username = encodeURIComponent(decodedUser);
        parsed.password = encodeURIComponent(decodedPassword);
        return parsed.toString();
    } catch (error) {
        console.warn('Mongo URI could not be normalized, using raw value:', error?.message || error);
        return uri;
    }
}

const mongoURI = normalizeMongoUri(rawMongoURI);

// Create MongoDB client for native driver operations
const client = new MongoClient(mongoURI, {
    // Keep defaults for MongoDB Node driver v4+
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
        // Pin to the same DB the native driver uses (dbName) — the connection URI
        // itself has no db path segment, so without this Mongoose silently defaults
        // to "test" while the native driver writes to pigeon_db. Two DBs meant
        // Mongoose-backed reads (e.g. /users/list) never saw native-driver writes
        // (e.g. workspace invites) even though both looked like they "worked".
        await mongoose.connect(mongoURI, {
            dbName,
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000
        });
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
        if (mongoose.connection?.readyState === 1 && mongoose.connection?.db) {
            return mongoose.connection.db;
        }
        return null;
    },
    client
};