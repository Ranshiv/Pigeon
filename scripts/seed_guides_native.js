require('dotenv').config();
const { MongoClient } = require('mongodb');

const mongoURI = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017';
const dbName = process.env.DB_NAME || 'pigeon_db';

async function seedNative() {
    console.log('Connecting native driver...');
    const client = new MongoClient(mongoURI);

    try {
        await client.connect();
        console.log('Connected.');
        const db = client.db(dbName);

        const apis = await db.collection('marketplaceapis').find({}).toArray();
        console.log(`Found ${apis.length} APIs.`);

        for (const api of apis) {
            // Note: api._id might be ObjectId or string depending on how it was seeded.
            // The request uses `api.id` which is the string ID (e.g. 'github').
            const listingId = api.id;
            const slug = `getting-started-${listingId}`;

            const existing = await db.collection('guides').findOne({ listingId, slug });

            if (!existing) {
                console.log(`Inserting guide for ${listingId}`);
                await db.collection('guides').insertOne({
                    listingId: listingId,
                    title: `Getting Started with ${api.name}`,
                    slug: slug,
                    summary: `Learn the basics of using the ${api.name} API effectively.`,
                    contentMarkdown: `# Getting Started with ${api.name}\n\nWelcome to the official guide for **${api.name}**.\n\n## Overview\n${api.description}\n\n## Basic Usage\n\`\`\`bash\ncurl ${api.baseUrl}\n\`\`\`\n`,
                    order: 0,
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
            } else {
                console.log(`Guide exists for ${listingId}`);
            }
        }
        console.log('Done.');
    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

seedNative();
