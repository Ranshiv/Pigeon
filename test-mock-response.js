// Quick test to diagnose mock response body issue
const mongoose = require('mongoose');
require('dotenv').config();

async function test() {
    try {
        await mongoose.connect(process.env.DATABASE_URL);
        console.log('Connected to MongoDB');

        const server = await mongoose.connection.db.collection('mockservers').findOne({
            _id: new mongoose.Types.ObjectId('6928cea81b7bdbd47899d77a')
        });

        console.log('\n=== Mock Server ===');
        console.log('Name:', server?.name);
        console.log('Is Active:', server?.isActive);

        console.log('\n=== Scenario Response Body ===');
        const scenario = server?.scenarios?.[0];
        const responseBody = scenario?.responses?.[0]?.body;

        console.log('Raw body:', responseBody);
        console.log('Type of body:', typeof responseBody);
        console.log('Is Map:', responseBody instanceof Map);
        console.log('Constructor:', responseBody?.constructor?.name);

        // Try different serialization methods
        console.log('\n=== Serialization Tests ===');
        console.log('JSON.stringify:', JSON.stringify(responseBody));

        if (responseBody && typeof responseBody === 'object') {
            console.log('Object.keys:', Object.keys(responseBody));
            console.log('Object.entries:', Object.entries(responseBody));
        }

        // Check the endpoint response body too
        console.log('\n=== Endpoint Response Body ===');
        const endpoint = server?.mockEndpoints?.[0];
        const endpointBody = endpoint?.responseBody;

        console.log('Raw body:', endpointBody);
        console.log('Type of body:', typeof endpointBody);
        console.log('JSON.stringify:', JSON.stringify(endpointBody));

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await mongoose.disconnect();
        console.log('\nDisconnected');
    }
}

test();
