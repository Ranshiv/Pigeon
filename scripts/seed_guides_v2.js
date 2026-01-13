const mongoose = require('mongoose');
const fs = require('fs');
require('dotenv').config();

const MarketplaceApi = require('../server/models/MarketplaceApi');
const Guide = require('../server/models/Guide');

async function seed() {
    try {
        const uri = process.env.DATABASE_URL || 'mongodb://localhost:27017/pigeon_db';
        console.log('Connecting to DB...');
        // Suppress strictQuery warning if present, or just connect
        mongoose.set('strictQuery', false);
        await mongoose.connect(uri);
        console.log('Connected to MongoDB.');

        const apis = await MarketplaceApi.find({});
        console.log(`Found ${apis.length} APIs.`);

        if (apis.length === 0) {
            console.log('No APIs found. Please run basic seed first.');
            process.exit(0);
        }

        let createdCount = 0;
        for (const api of apis) {
            const listingId = api.id;
            // Generate a simpler slug to avoid regex issues or whatever
            const slug = `getting-started`;

            // Check if ANY guide exists for this listing
            const existingCount = await Guide.countDocuments({ listingId });

            if (existingCount === 0) {
                console.log(`Creating guide for ${api.name} (${listingId})...`);

                const content = `# Getting Started with ${api.name}

Welcome to the official developer guide for **${api.name}**. This guide will help you get up and running quickly.

## Overview
${api.description}

## Authentication
**Auth Type:** ${api.authType}

${api.authType === 'API Key' ? 'You need to include your API key in the request headers.' : ''}

## Base URL
\`${api.baseUrl}\`

## Example Request
Here is how you can make your first request:

\`\`\`bash
curl -X GET "${api.baseUrl}${api.endpoints[0]?.path || ''}"
\`\`\`

## Next Steps
Explore the **Endpoints** tab to see all available operations.
`;

                await Guide.create({
                    listingId,
                    title: `Getting Started with ${api.name}`,
                    slug, // "getting-started"
                    summary: `Learn the basics of using the ${api.name} API effectively.`,
                    contentMarkdown: content,
                    order: 1
                });
                createdCount++;
            } else {
                // console.log(`Guide already exists for ${api.name}`);
            }
        }

        console.log(`Seeding complete. Created ${createdCount} new guides.`);

        // Final check
        const totalGuides = await Guide.countDocuments();
        console.log(`Total guides in DB: ${totalGuides}`);

        fs.appendFileSync('seed_log.txt', `Success! Created ${createdCount} guides. Total: ${totalGuides}. Timestamp: ${new Date().toISOString()}\n`);

        process.exit(0);

    } catch (e) {
        console.error('Error:', e);
        fs.appendFileSync('seed_log.txt', `Error: ${e.message}. Timestamp: ${new Date().toISOString()}\n`);
        process.exit(1);
    }
}

seed();
