require('dotenv').config();
const { MongoClient } = require('mongodb');

const mongoURI = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017';
const dbName = process.env.DB_NAME || 'pigeon_db';

async function inspect() {
    console.log(`Connecting to ${mongoURI} ...`);
    console.log(`Target Database: ${dbName}`);

    const client = new MongoClient(mongoURI);

    try {
        await client.connect();

        // List databases
        const adminDb = client.db().admin();
        const dbs = await adminDb.listDatabases();
        console.log('Databases available:', dbs.databases.map(d => d.name));

        const db = client.db(dbName);
        console.log(`Connected to database: ${dbName}`);

        const collections = await db.listCollections().toArray();
        console.log('Collections in this DB:');

        if (collections.length === 0) {
            console.log('  (No collections found)');
        }

        for (const col of collections) {
            const count = await db.collection(col.name).countDocuments();
            console.log(`  - ${col.name}: ${count} documents`);
        }

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await client.close();
    }
}

inspect();
