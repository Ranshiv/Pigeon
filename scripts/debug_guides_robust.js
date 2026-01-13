const mongoose = require('mongoose');
require('dotenv').config();

// Create a local GuideService to test the logic exactly as it is in the file, 
// but we need to ensure we use the correct paths.
// Since we are in scripts/, the path to GuideService is ../features/api-marketplace/GuideService
const GuideService = require('../features/api-marketplace/GuideService'); // This uses the lazily modified version
const MarketplaceApi = require('../models/MarketplaceApi'); // Use the root model as used by routes
const Guide = require('../server/models/Guide');

async function debug() {
    try {
        console.log('--- DIAGNOSTIC START ---');
        const uri = process.env.DATABASE_URL || 'mongodb://localhost:27017/pigeon_db';
        mongoose.set('strictQuery', false);
        await mongoose.connect(uri);
        console.log('Connected to DB');

        // 1. Find the PokeAPI
        const pokeApi = await MarketplaceApi.findOne({ name: { $regex: /poke/i } });
        if (!pokeApi) {
            console.log('CRITICAL: PokeAPI not found in DB!');
            const allApis = await MarketplaceApi.find({}, 'name id');
            console.log('Available APIs:', allApis.map(a => `${a.name} (${a.id})`).join(', '));
        } else {
            console.log(`Found PokeAPI: ${pokeApi.name} (id: "${pokeApi.id}", _id: ${pokeApi._id})`);

            // 2. Check for Guides using direct DB access
            let guides = await Guide.find({ listingId: pokeApi.id });
            console.log(`Direct DB check: Found ${guides.length} guides for listingId "${pokeApi.id}"`);

            // 3. Test GuideService.listGuides (which should trigger auto-seed)
            console.log('Testing GuideService.listGuides()...');
            const serviceGuides = await GuideService.listGuides(pokeApi.id);
            console.log(`GuideService returned ${serviceGuides.length} guides.`);

            if (serviceGuides.length > 0) {
                console.log('First guide title:', serviceGuides[0].title);
            } else {
                console.log('CRITICAL: GuideService failed to return guides even after auto-seed attempt.');
            }

            // 4. Double check directly
            guides = await Guide.find({ listingId: pokeApi.id });
            console.log(`Final Direct DB check: Found ${guides.length} guides.`);
        }

        console.log('--- DIAGNOSTIC END ---');
        process.exit(0);
    } catch (e) {
        console.error('ERROR:', e);
        process.exit(1);
    }
}

debug();
