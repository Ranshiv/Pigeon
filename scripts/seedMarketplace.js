require('dotenv').config();
const { connectMongoose } = require('../config/db');
const MarketplaceApi = require('../models/MarketplaceApi');
const mongoose = require('mongoose');

// Catalog lives in scripts/marketplaceCatalog.js so the verifier script
// tests the exact same data the seed writes. Edit endpoints there.
const { publicApiCatalog } = require('./marketplaceCatalog');

async function seed() {
    try {
        await connectMongoose();
        console.log('Connected to MongoDB');

        // Clear existing APIs
        await MarketplaceApi.deleteMany({});
        console.log('Cleared existing marketplace APIs');

        // Insert new APIs
        // Ensure every API has a provider
        publicApiCatalog.forEach(api => {
            if (!api.provider) {
                api.provider = api.name || api.id || 'Unknown Provider';
            }
        });

        const result = await MarketplaceApi.insertMany(publicApiCatalog);
        console.log(`Successfully inserted ${result.length} APIs`);
        require('fs').writeFileSync('seed_success.txt', `Inserted ${result.length} APIs`);

        // Create text index explicitly if needed, but schema handles it
        // await MarketplaceApi.createIndexes();

        console.log('Done!');
        process.exit(0);
    } catch (err) {
        const errorMsg = `Error seeding database: ${err.message}\n${JSON.stringify(err.errors, null, 2)}`;
        require('fs').writeFileSync('seed_error.txt', errorMsg);
        console.error('Error seeding database:', err);
        process.exit(1);
    }
}

seed();
