const mongoose = require('mongoose');
require('dotenv').config();

async function checkDB() {
    try {
        await mongoose.connect(process.env.DATABASE_URL || process.env.MONGODB_URI);
        console.log('Connected to DB');
        const count = await mongoose.connection.db.collection('marketplaceapis').countDocuments();
        console.log('Marketplace APIs count:', count);
        const apis = await mongoose.connection.db.collection('marketplaceapis').find({}).limit(5).toArray();
        console.log('First 5 APIs:', apis.map(a => a.name));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkDB();
