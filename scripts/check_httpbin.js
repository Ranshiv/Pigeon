const mongoose = require('mongoose');
const { MongoClient } = require('mongodb');

const mongoURI = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017';
const dbName = process.env.DB_NAME || 'pigeon_db';

async function checkHttpbin() {
    const client = new MongoClient(mongoURI);
    await client.connect();
    const db = client.db(dbName);

    console.log('Checking for "httpbin" API...');
    const api = await db.collection('marketplaceapis').findOne({ id: 'httpbin' });
    console.log('API found:', api ? 'YES' : 'NO');
    if (api) console.log('API _id:', api._id);

    console.log('Checking for guides with listingId: "httpbin"...');
    const guides = await db.collection('guides').find({ listingId: 'httpbin' }).toArray();
    console.log(`Found ${guides.length} guides.`);
    console.log(guides);

    await client.close();
}

checkHttpbin();
