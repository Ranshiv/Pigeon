// Database Index Cleanup Script
// Run this to fix the duplicate index issue

const mongoose = require('mongoose');
require('dotenv').config();

async function fixIndexIssue() {
    try {
        // Connect to database
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/pigeon');
        console.log('✅ Connected to MongoDB');

        // Get the ApiVersion collection
        const db = mongoose.connection.db;
        const collection = db.collection('apiversions');

        // List current indexes
        console.log('\n📋 Current indexes:');
        const indexes = await collection.indexes();
        indexes.forEach((index, i) => {
            console.log(`${i + 1}. ${JSON.stringify(index.key)} - ${index.name}`);
        });

        // Option 1: Drop the problematic index
        try {
            await collection.dropIndex('collectionId_1_versionString_1');
            console.log('\n✅ Dropped problematic versionString index');
        } catch (error) {
            console.log('\n⚠️  versionString index not found or already dropped');
        }

        // Option 2: Clean up duplicate entries
        console.log('\n🧹 Cleaning up duplicate entries...');

        // Find documents with null versionString
        const duplicates = await collection.find({ versionString: null }).toArray();
        console.log(`Found ${duplicates.length} documents with null versionString`);

        // Update them to use the version field
        for (const doc of duplicates) {
            if (doc.version) {
                await collection.updateOne(
                    { _id: doc._id },
                    { $set: { versionString: doc.version } }
                );
                console.log(`Updated document ${doc._id}: versionString = ${doc.version}`);
            }
        }

        // Option 3: Remove actual duplicates
        const pipeline = [
            {
                $group: {
                    _id: { collectionId: "$collectionId", versionString: "$versionString" },
                    docs: { $push: "$_id" },
                    count: { $sum: 1 }
                }
            },
            {
                $match: { count: { $gt: 1 } }
            }
        ];

        const realDuplicates = await collection.aggregate(pipeline).toArray();
        console.log(`\nFound ${realDuplicates.length} groups of actual duplicates`);

        for (const group of realDuplicates) {
            // Keep the first document, remove the rest
            const [keep, ...remove] = group.docs;
            if (remove.length > 0) {
                await collection.deleteMany({ _id: { $in: remove } });
                console.log(`Removed ${remove.length} duplicate documents, kept ${keep}`);
            }
        }

        console.log('\n🎉 Database cleanup completed successfully!');
        console.log('\n💡 You can now try creating API versions again.');

    } catch (error) {
        console.error('❌ Error fixing database:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n📦 Disconnected from MongoDB');
    }
}

// Run the fix
console.log('🔧 Starting database index fix...\n');
fixIndexIssue();
