const mongoose = require('mongoose');
require('dotenv').config();

async function main() {
    const commit = process.argv.includes('--commit');
    const uri = process.env.DATABASE_URL || process.env.MONGODB_URI || 'mongodb://localhost:27017';
    const dbName = process.env.DB_NAME || 'pigeon_db';
    await mongoose.connect(uri, { dbName });
    const db = mongoose.connection.db;

    // Delete collections created by the visual designer auto-create bug:
    // name ends with "Visual Design" but has no saved visual designer data.
    const filter = {
        name: { $regex: ' Visual Design$', $options: 'i' },
        $or: [
            { metadata: { $exists: false } },
            { 'metadata.visualDesigner': { $exists: false } }
        ]
    };

    const docs = await db.collection('collections').find(filter).project({ name: 1, owner: 1, createdAt: 1 }).toArray();

    console.log(`Found ${docs.length} orphan visual-design collections.`);
    if (docs.length > 0) {
        console.log('First 10:', docs.slice(0, 10).map(d => ({ _id: d._id, name: d.name, createdAt: d.createdAt })));
    }

    if (commit) {
        const result = await db.collection('collections').deleteMany(filter);
        console.log(`Deleted ${result.deletedCount} collections.`);
    } else {
        console.log('Dry run — pass --commit to delete.');
    }

    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
