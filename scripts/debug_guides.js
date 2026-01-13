const mongoose = require('mongoose');
require('dotenv').config();

console.log('Debug script started');

async function debug() {
    try {
        console.log('Connecting to DB...');
        await mongoose.connect(process.env.DATABASE_URL || 'mongodb://localhost:27017/pigeon_db');
        console.log('Connected.');

        const guidesCount = await mongoose.connection.db.collection('guides').countDocuments();
        console.log('Guides count:', guidesCount);

        const apiCount = await mongoose.connection.db.collection('marketplaceapis').countDocuments();
        console.log('APIs count:', apiCount);

        const guides = await mongoose.connection.db.collection('guides').find({}).limit(1).toArray();
        console.log('Sample guide:', guides[0]);

        process.exit(0);
    } catch (e) {
        console.error('Error:', e);
        process.exit(1);
    }
}

debug();
