require('dotenv').config();
const { MongoClient } = require('mongodb');

async function test() {
    const uri = process.env.MONGODB_URI || process.env.DATABASE_URL;
    const client = new MongoClient(uri);
    try {
        await client.connect();
        console.log('Connected');
        const dbs = await client.db().admin().listDatabases();
        console.log(dbs.databases.map(db => db.name));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
test();
