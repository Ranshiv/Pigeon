const { MongoClient } = require('mongodb');

// Use the simplest possible connection string to avoid issues
const uri = 'mongodb://localhost:27017';
const client = new MongoClient(uri);

async function run() {
    try {
        await client.connect();
        const database = client.db('pigeon_db');
        const guides = database.collection('guides');

        // Query for guides where listingId is 'httpbin'
        const query = { listingId: 'httpbin' };
        const count = await guides.countDocuments(query);
        const docs = await guides.find(query).toArray();

        console.log(`Guides found for 'httpbin': ${count}`);
        if (count > 0) {
            console.log('Sample Guide:', JSON.stringify(docs[0], null, 2));
        } else {
            // List all guides to see if IDs are mismatching
            const allGuides = await guides.find({}).limit(5).toArray();
            console.log('Sample of ANY guides:', allGuides);
        }

    } finally {
        await client.close();
    }
}
run().catch(console.dir);
