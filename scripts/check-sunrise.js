require('dotenv').config();
const { connectMongoose } = require('./config/db');
const MarketplaceApi = require('./models/MarketplaceApi');

async function check() {
    try {
        await connectMongoose();
        const api = await MarketplaceApi.findOne({ id: 'sunrisesunset' });
        console.log(JSON.stringify(api, null, 2));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
check();
