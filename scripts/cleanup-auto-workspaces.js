const mongoose = require('mongoose');
require('dotenv').config();

async function main() {
    const commit = process.argv.includes('--commit');
    const uri = process.env.DATABASE_URL || process.env.MONGODB_URI || 'mongodb://localhost:27017';
    const dbName = process.env.DB_NAME || 'pigeon_db';
    await mongoose.connect(uri, { dbName });
    const db = mongoose.connection.db;

    const ownerId = process.argv.find(a => a.startsWith('--owner='))?.slice(8);

    const autoNames = ['API Testing', 'Default Workspace'];
    let ownerFilter = {};
    if (ownerId) {
        const ownerObjectId = mongoose.Types.ObjectId.isValid(ownerId) ? new mongoose.Types.ObjectId(ownerId) : null;
        ownerFilter = ownerObjectId
            ? { $or: [{ owner: ownerId }, { owner: ownerObjectId }] }
            : { owner: ownerId };
    }
    const filter = ownerId
        ? { name: { $in: autoNames }, ...ownerFilter }
        : { name: { $in: autoNames } };

    const docs = await db.collection('workspaces').find(filter).project({ name: 1, owner: 1, createdAt: 1 }).toArray();

    console.log(`Found ${docs.length} auto-looking workspaces.`);
    if (docs.length > 0) {
        console.log(JSON.stringify(docs, null, 2));
    }

    if (commit) {
        const result = await db.collection('workspaces').deleteMany(filter);
        console.log(`Deleted ${result.deletedCount} workspaces.`);
    } else {
        console.log('Dry run — pass --commit to delete.');
        if (!ownerId) console.log('Tip: pass --owner=<id> to limit to one user.');
    }

    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
