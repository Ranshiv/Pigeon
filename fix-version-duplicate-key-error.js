// fix-version-duplicate-key-error.js
// Script to fix the duplicate key error for API versions

const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://pigeon:pigeon@pigeon.3qivb.mongodb.net/?retryWrites=true&w=majority&appName=Pigeon';

async function fixVersionDuplicateKeyError() {
    console.log('🔧 Starting fix for version duplicate key error...');

    try {
        // Connect to MongoDB
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        const db = mongoose.connection.db;
        const collection = db.collection('apiversions');

        // 1. Check current indexes
        console.log('\n📋 Current indexes on apiversions collection:');
        const indexes = await collection.indexes();
        indexes.forEach((index, i) => {
            console.log(`${i + 1}. ${JSON.stringify(index.key)} - ${index.name || 'unnamed'}`);
        });

        // 2. Check for old versionString index
        const oldIndexExists = indexes.some(index =>
            index.key.collectionId && index.key.versionString
        );

        if (oldIndexExists) {
            console.log('\n❌ Found old index on collectionId + versionString');

            // Try to drop the old index
            try {
                await collection.dropIndex('collectionId_1_versionString_1');
                console.log('✅ Dropped old index: collectionId_1_versionString_1');
            } catch (error) {
                console.log('⚠️  Could not drop old index (it might not exist):', error.message);
            }
        } else {
            console.log('✅ No old versionString index found');
        }

        // 3. Check for existing documents with null version field
        console.log('\n🔍 Checking for documents with null version field...');
        const docsWithNullVersion = await collection.find({
            $or: [
                { version: null },
                { version: { $exists: false } },
                { versionString: { $exists: true } } // Legacy field
            ]
        }).toArray();

        console.log(`Found ${docsWithNullVersion.length} documents with version issues`);

        if (docsWithNullVersion.length > 0) {
            console.log('\n🗑️  Documents with version issues:');
            docsWithNullVersion.forEach((doc, i) => {
                console.log(`${i + 1}. ID: ${doc._id}, collectionId: ${doc.collectionId}, version: ${doc.version}, versionString: ${doc.versionString}`);
            });

            // 4. Clean up or migrate problematic documents
            for (const doc of docsWithNullVersion) {
                if (doc.versionString && !doc.version) {
                    // Migrate versionString to version
                    console.log(`📦 Migrating document ${doc._id}: versionString "${doc.versionString}" -> version`);
                    await collection.updateOne(
                        { _id: doc._id },
                        {
                            $set: { version: doc.versionString },
                            $unset: { versionString: 1 }
                        }
                    );
                } else if (!doc.version && !doc.versionString) {
                    // Document has no version at all - remove it or set a default
                    console.log(`🗑️  Removing document ${doc._id} with no version information`);
                    await collection.deleteOne({ _id: doc._id });
                }
            }
        }

        // 5. Ensure the correct index exists
        console.log('\n🔧 Ensuring correct index exists...');
        try {
            await collection.createIndex(
                { collectionId: 1, version: 1 },
                { unique: true, name: 'collectionId_1_version_1' }
            );
            console.log('✅ Created/ensured correct index: collectionId_1_version_1');
        } catch (error) {
            if (error.message.includes('already exists')) {
                console.log('✅ Correct index already exists');
            } else {
                console.error('❌ Error creating index:', error.message);
            }
        }

        // 6. Final verification
        console.log('\n🔍 Final verification...');
        const finalIndexes = await collection.indexes();
        console.log('Current indexes:');
        finalIndexes.forEach((index, i) => {
            console.log(`${i + 1}. ${JSON.stringify(index.key)} - ${index.name || 'unnamed'}`);
        });

        // Check for any remaining duplicates
        const duplicates = await collection.aggregate([
            {
                $group: {
                    _id: { collectionId: "$collectionId", version: "$version" },
                    count: { $sum: 1 },
                    docs: { $push: "$_id" }
                }
            },
            {
                $match: { count: { $gt: 1 } }
            }
        ]).toArray();

        if (duplicates.length > 0) {
            console.log('\n⚠️  Found remaining duplicates:');
            duplicates.forEach((dup, i) => {
                console.log(`${i + 1}. collectionId: ${dup._id.collectionId}, version: ${dup._id.version}, count: ${dup.count}`);
                console.log(`   Document IDs: ${dup.docs.join(', ')}`);
            });
        } else {
            console.log('✅ No duplicates found');
        }

        console.log('\n🎉 Fix completed successfully!');

    } catch (error) {
        console.error('❌ Error during fix:', error);

        // Log additional debug information
        if (error.message.includes('E11000')) {
            console.log('\n🔍 Additional debugging for E11000 error:');
            console.log('Error details:', error.message);

            // Try to find the exact duplicate
            const db = mongoose.connection.db;
            const collection = db.collection('apiversions');

            try {
                const docs = await collection.find({}).toArray();
                console.log(`\nTotal documents in collection: ${docs.length}`);

                // Group by collectionId and version to find duplicates
                const groups = {};
                docs.forEach(doc => {
                    const key = `${doc.collectionId}_${doc.version}`;
                    if (!groups[key]) {
                        groups[key] = [];
                    }
                    groups[key].push(doc);
                });

                console.log('\nGrouped documents:');
                Object.keys(groups).forEach(key => {
                    const group = groups[key];
                    if (group.length > 1) {
                        console.log(`🚨 DUPLICATE: ${key} has ${group.length} documents`);
                        group.forEach(doc => {
                            console.log(`   - ID: ${doc._id}, version: ${doc.version}, name: ${doc.name}`);
                        });
                    }
                });

            } catch (debugError) {
                console.log('Could not fetch documents for debugging:', debugError.message);
            }
        }
    } finally {
        await mongoose.disconnect();
        console.log('👋 Disconnected from MongoDB');
    }
}

// Run the fix
if (require.main === module) {
    fixVersionDuplicateKeyError()
        .then(() => {
            console.log('✅ Script completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Script failed:', error);
            process.exit(1);
        });
}

module.exports = { fixVersionDuplicateKeyError };
