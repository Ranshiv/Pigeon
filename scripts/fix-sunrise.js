require('dotenv').config();
const { connectMongoose } = require('./config/db');
const MarketplaceApi = require('./models/MarketplaceApi');

async function fix() {
    try {
        await connectMongoose();
        console.log('Connected');
        const res = await MarketplaceApi.updateOne(
            { id: 'sunrisesunset' },
            {
                baseUrl: 'https://api.sunrise-sunset.org',
                endpoints: [
                    {
                        path: '/json',
                        method: 'GET',
                        description: 'Get solar data',
                        parameters: [
                            { name: 'lat', type: 'query', required: true, description: 'Latitude' },
                            { name: 'lng', type: 'query', required: true, description: 'Longitude' }
                        ]
                    }
                ]
            }
        );
        console.log('Update result:', res);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
fix();
