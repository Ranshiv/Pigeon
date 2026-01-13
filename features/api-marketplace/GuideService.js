const Guide = require('../../server/models/Guide');
const MarketplaceApi = require('../../models/MarketplaceApi');

class GuideService {
    async listGuides(listingId) {
        console.log(`[GuideService] Finding guides for listingId="${listingId}"`);
        let guides = await Guide.find({ listingId })
            .sort({ order: 1, createdAt: 1 })
            .select('title slug summary order createdAt');

        if (guides.length === 0) {
            console.log(`[GuideService] No guides found for ${listingId}. Seeding default guide...`);
            await this.seedDefaultGuide(listingId);
            // Re-fetch
            guides = await Guide.find({ listingId })
                .sort({ order: 1, createdAt: 1 })
                .select('title slug summary order createdAt');
        }

        console.log(`[GuideService] Result count: ${guides.length}`);
        return guides;
    }

    async seedDefaultGuide(listingId) {
        try {
            const api = await MarketplaceApi.findOne({ id: listingId });
            if (!api) {
                console.warn(`[GuideService] Cannot seed guide: API ${listingId} not found`);
                return;
            }

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
curl -X GET "${api.baseUrl}${api.endpoints && api.endpoints[0] ? api.endpoints[0].path : ''}"
\`\`\`

## Next Steps
Explore the **Endpoints** tab to see all available operations.
`;

            await this.createGuide(listingId, {
                title: `Getting Started with ${api.name}`,
                contentMarkdown: content,
                order: 1
            });
            console.log(`[GuideService] Seeded default guide for ${listingId}`);
        } catch (err) {
            console.error(`[GuideService] Failed to seed default guide for ${listingId}:`, err);
        }
    }

    async getGuide(listingId, slug) {
        const guide = await Guide.findOne({ listingId, slug });
        if (!guide) throw new Error('Guide not found');
        return guide;
    }

    async createGuide(listingId, { title, contentMarkdown, order }) {
        // Simple slug generation
        const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

        const guide = new Guide({
            listingId,
            title,
            slug,
            contentMarkdown,
            contentMarkdown,
            order,
            summary: contentMarkdown.substring(0, 150).replace(/[#*`]/g, '') + '...'
        });
        await guide.save();
        return guide;
    }
}

module.exports = new GuideService();
