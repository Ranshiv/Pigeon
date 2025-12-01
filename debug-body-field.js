// Debug script to inspect exact structure of response body field
require('dotenv').config();
const mongoose = require('mongoose');

const uri = process.env.DATABASE_URL || process.env.MONGODB_URI;

async function debugBody() {
    try {
        await mongoose.connect(uri);
        console.log('Connected to MongoDB');

        const mockServerId = '6928cea81b7bdbd47899d77a';

        // Get raw document from MongoDB (bypassing Mongoose model)
        const db = mongoose.connection.db;
        const collection = db.collection('mockservers');

        const rawDoc = await collection.findOne({ _id: new mongoose.Types.ObjectId(mockServerId) });

        if (!rawDoc) {
            console.log('Mock server not found');
            return;
        }

        console.log('\n=== RAW MONGODB DOCUMENT ===');
        console.log('Scenarios count:', rawDoc.scenarios?.length);

        if (rawDoc.scenarios && rawDoc.scenarios.length > 0) {
            const scenario = rawDoc.scenarios[0];
            console.log('\n--- Scenario 0 ---');
            console.log('Name:', scenario.name);
            console.log('Responses count:', scenario.responses?.length);

            if (scenario.responses && scenario.responses.length > 0) {
                const response = scenario.responses[0];
                console.log('\n--- Response 0 ---');
                console.log('Response name:', response.name);
                console.log('Status code:', response.statusCode);
                console.log('Body type:', typeof response.body);
                console.log('Body value:', response.body);
                console.log('Body JSON:', JSON.stringify(response.body, null, 2));
                console.log('Body keys:', response.body ? Object.keys(response.body) : 'N/A');

                // Check each property of body
                if (response.body && typeof response.body === 'object') {
                    for (const [key, value] of Object.entries(response.body)) {
                        console.log(`  body.${key} type:`, typeof value);
                        console.log(`  body.${key} value:`, value);
                        console.log(`  body.${key} JSON:`, JSON.stringify(value));
                    }
                }
            }
        }

        // Now try via Mongoose model
        console.log('\n=== VIA MONGOOSE MODEL ===');
        const MockServer = require('./models/MockServer');
        const mockServer = await MockServer.findById(mockServerId);

        if (mockServer && mockServer.scenarios && mockServer.scenarios.length > 0) {
            const scenario = mockServer.scenarios[0];
            console.log('\n--- Scenario 0 via Mongoose ---');
            console.log('Name:', scenario.name);

            if (scenario.responses && scenario.responses.length > 0) {
                const response = scenario.responses[0];
                console.log('\n--- Response 0 via Mongoose ---');
                console.log('Body type:', typeof response.body);
                console.log('Body constructor:', response.body?.constructor?.name);
                console.log('Body value:', response.body);
                console.log('Body JSON.stringify:', JSON.stringify(response.body));

                // Try toObject
                console.log('\nTrying response.toObject():');
                try {
                    const responseObj = response.toObject ? response.toObject() : response;
                    console.log('Body after toObject:', responseObj.body);
                    console.log('Body JSON after toObject:', JSON.stringify(responseObj.body));
                } catch (e) {
                    console.log('toObject error:', e.message);
                }

                // Try scenario.toObject
                console.log('\nTrying scenario.toObject():');
                try {
                    const scenarioObj = scenario.toObject ? scenario.toObject() : scenario;
                    console.log('Response body from scenarioObj:', scenarioObj.responses[0].body);
                    console.log('Response body JSON:', JSON.stringify(scenarioObj.responses[0].body));
                } catch (e) {
                    console.log('scenario toObject error:', e.message);
                }
            }
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

debugBody();
