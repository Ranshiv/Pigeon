// routes/apiMarketplace.js
const express = require('express');
const router = express.Router();
const MarketplaceApi = require('../models/MarketplaceApi');
const https = require('https'); // Add https to handle SSL issues
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

// Feature Services
const ReviewService = require('../features/api-marketplace/ReviewService');
const CommunityForums = require('../features/api-marketplace/CommunityForums');
const GuideService = require('../features/api-marketplace/GuideService');
const HealthService = require('../features/api-marketplace/HealthService');

// GET /api/marketplace/search - Search public APIs
router.get('/search', async (req, res) => {
    try {
        const { query = '', category = '', tags = '', page = 1, limit = 12, sort = 'popular' } = req.query;

        // Build filter
        const filter = {};

        // Filter by search query using text index or regex
        if (query) {
            // Using regex for partial matches on name/description if text index search is too strict or not set up
            const searchRegex = new RegExp(query, 'i');
            filter.$or = [
                { name: searchRegex },
                { description: searchRegex },
                { provider: searchRegex },
                { tags: searchRegex }
            ];
        }

        // Filter by category
        if (category && category !== 'All') {
            filter.category = category;
        }

        // Filter by tags
        if (tags) {
            const tagArray = tags.split(',').map(t => t.trim());
            // Match any of the tags provided
            filter.tags = { $in: tagArray.map(t => new RegExp(`^${t}$`, 'i')) };
        }

        // Sort options
        let sortOption = {};
        switch (sort) {
            case 'popular':
                sortOption = { usageCount: -1 };
                break;
            case 'rating':
                sortOption = { ratingAverage: -1 };
                break;
            case 'name':
                sortOption = { name: 1 };
                break;
            default:
                sortOption = { usageCount: -1 }; // Default to popular
                break;
        }

        // Pagination
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;

        // Execute query
        const results = await MarketplaceApi.find(filter)
            .sort(sortOption)
            .skip(skip)
            .limit(limitNum);

        const total = await MarketplaceApi.countDocuments(filter);

        res.json({
            results,
            total,
            page: pageNum,
            totalPages: Math.ceil(total / limitNum),
            hasMore: (skip + results.length) < total
        });
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: 'Failed to search APIs', message: error.message });
    }
});

// GET /api/marketplace/categories - Get all unique categories
router.get('/categories', async (req, res) => {
    try {
        // Aggregation to get categories and their counts
        const categories = await MarketplaceApi.aggregate([
            { $group: { _id: "$category", count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]);

        const formattedCategories = categories.map(c => ({
            name: c._id,
            count: c.count
        }));

        res.json(formattedCategories);
    } catch (error) {
        console.error('Categories error:', error);
        res.status(500).json({ error: 'Failed to get categories', message: error.message });
    }
});

// GET /api/marketplace/tags - Get all unique tags
router.get('/tags', async (req, res) => {
    try {
        const tags = await MarketplaceApi.aggregate([
            { $unwind: "$tags" },
            { $group: { _id: "$tags", count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        const formattedTags = tags.map(t => ({
            name: t._id,
            count: t.count
        }));

        res.json(formattedTags);
    } catch (error) {
        console.error('Tags error:', error);
        res.status(500).json({ error: 'Failed to get tags', message: error.message });
    }
});

// GET /api/marketplace/featured - Get featured APIs
router.get('/featured', async (req, res) => {
    try {
        const featured = await MarketplaceApi.find({ featured: true });
        res.json(featured);
    } catch (error) {
        console.error('Featured error:', error);
        res.status(500).json({ error: 'Failed to get featured APIs', message: error.message });
    }
});

// GET /api/marketplace/trending - Get trending APIs
router.get('/trending', async (req, res) => {
    try {
        const trending = await MarketplaceApi.find({ trending: true });
        res.json(trending);
    } catch (error) {
        console.error('Trending error:', error);
        res.status(500).json({ error: 'Failed to get trending APIs', message: error.message });
    }
});

// GET /api/marketplace/recommended-collections - Get recommended collections
router.get('/recommended-collections', async (req, res) => {
    try {
        // For now, return some featured ones or a random selection
        // In a real app, this would be based on user preferences
        const collections = [
            {
                _id: 'rec-1',
                name: 'Essential Web APIs',
                description: 'A collection of the most useful APIs for web development',
                author: { displayName: 'Pigeon Curator' },
                stars: 450
            },
            {
                _id: 'rec-2',
                name: 'Data Science Toolkit',
                description: 'APIs for data processing, ML, and visualization',
                author: { displayName: 'DataMaster' },
                stars: 320
            },
            {
                _id: 'rec-3',
                name: 'Entertainment & Fun',
                description: 'Most popular joke, image, and trivia APIs',
                author: { displayName: 'FunBot' },
                stars: 280
            }
        ];
        res.json(collections);
    } catch (error) {
        console.error('Recommended collections error:', error);
        res.status(500).json({ error: 'Failed to get recommended collections', message: error.message });
    }
});

// GET /api/marketplace/api/:id - Get specific API details
router.get('/api/:id', async (req, res) => {
    try {
        // Clean URL parameter
        const id = req.params.id;

        // Find by id (string id)
        const api = await MarketplaceApi.findOne({ id: id });

        if (!api) {
            return res.status(404).json({ error: 'API not found' });
        }
        res.json(api);
    } catch (error) {
        console.error('API detail error:', error);
        res.status(500).json({ error: 'Failed to get API details', message: error.message });
    }
});

// Alias for client compatibility
router.get('/listings/:id', async (req, res) => {
    // Re-use logic or redirect? Re-use is cheaper for now.
    try {
        const id = req.params.id;
        const api = await MarketplaceApi.findOne({ id: id });
        if (!api) return res.status(404).json({ error: 'API not found' });
        res.json(api);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get API details' });
    }
});

router.get('/listings', async (req, res) => {
    // Alias to search
    // We need to re-route logic because res.redirect might change method or lose query
    // But for a simple GET alias it works.
    // Actually, let's just use the search handler logic if we can, or just redirect
    const url = '/api/marketplace/search' + (req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '');
    res.redirect(url);
});


// --- V2 Feature Routes ---

// 1. Reviews
router.get('/listings/:id/reviews', async (req, res) => {
    try {
        const results = await ReviewService.getReviews(req.params.id, req.query);
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/listings/:id/reviews', async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
        const review = await ReviewService.createReview(req.params.id, req.user._id, req.body);
        res.json(review);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Forums
router.get('/listings/:id/forums/threads', async (req, res) => {
    try {
        const results = await CommunityForums.listThreads(req.params.id, req.query);
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/listings/:id/forums/threads', async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
        const thread = await CommunityForums.createThread(req.params.id, req.user._id, req.body);
        res.json(thread);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/forums/threads/:threadId', async (req, res) => {
    try {
        const result = await CommunityForums.getThread(req.params.threadId);
        res.json(result);
    } catch (err) {
        res.status(404).json({ error: err.message });
    }
});

router.post('/forums/threads/:threadId/posts', async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
        const post = await CommunityForums.replyToThread(req.params.threadId, req.user._id, req.body);
        res.json(post);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Guides
router.get('/listings/:id/guides', async (req, res) => {
    try {
        console.log(`[DEBUG] Fetching guides for listingId: ${req.params.id}`);
        const results = await GuideService.listGuides(req.params.id);
        console.log(`[DEBUG] Found ${results.length} guides for ${req.params.id}`);
        res.json(results);
    } catch (err) {
        console.error(`[DEBUG] Error fetching guides: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

router.get('/listings/:id/guides/:slug', async (req, res) => {
    try {
        const guide = await GuideService.getGuide(req.params.id, req.params.slug);
        res.json(guide);
    } catch (err) {
        res.status(404).json({ error: err.message });
    }
});

router.post('/listings/:id/guides', async (req, res) => {
    try {
        // In real app, check for admin/creator permissions
        const guide = await GuideService.createGuide(req.params.id, req.body);
        res.json(guide);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. Health
router.get('/listings/:id/health', async (req, res) => {
    try {
        const health = await HealthService.getHealth(req.params.id);
        res.json(health);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 5. Plans (Mock for now)
router.get('/listings/:id/plans', (req, res) => {
    res.json({
        enabled: true,
        plans: [
            { _id: 'p1', name: 'Developer', description: 'For hobbyists', isFree: true, pricePerMonth: 0, currency: 'USD' },
            { _id: 'p2', name: 'Pro', description: 'High rate limits', isFree: false, pricePerMonth: 29, currency: 'USD' }
        ]
    });
});

// POST /api/marketplace/proxy - Proxy requests to external APIs (for Try It feature)
router.post('/proxy', async (req, res) => {
    const startTime = Date.now();

    try {
        const { url, method = 'GET', headers = {}, body, queryParams = {} } = req.body;

        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }

        // Build URL with query parameters
        const urlObj = new URL(url);
        Object.entries(queryParams).forEach(([key, value]) => {
            if (value) {
                urlObj.searchParams.append(key, value);
            }
        });

        // Create an agent to allow insecure connections if needed
        const agent = new https.Agent({
            rejectUnauthorized: req.body.rejectUnauthorized !== undefined ? req.body.rejectUnauthorized : false // Default to false for marketplace trial to be more user-friendly
        });

        // Prepare fetch options
        const fetchOptions = {
            method: method.toUpperCase(),
            headers: {
                'User-Agent': 'Pigeon-API-Client/1.0',
                ...headers
            },
            agent
        };

        // Add body for POST, PUT, PATCH requests
        if (['POST', 'PUT', 'PATCH'].includes(fetchOptions.method) && body) {
            if (typeof body === 'object') {
                fetchOptions.body = JSON.stringify(body);
                fetchOptions.headers['Content-Type'] = 'application/json';
            } else {
                fetchOptions.body = body;
            }
        }

        // Make the request
        const externalResponse = await fetch(urlObj.toString(), fetchOptions);
        const duration = Date.now() - startTime;

        // Parse response
        const responseHeaders = {};
        externalResponse.headers.forEach((value, name) => {
            responseHeaders[name] = value;
        });

        let responseBody;
        const contentType = responseHeaders['content-type'] || '';

        if (contentType.includes('application/json')) {
            responseBody = await externalResponse.json();
        } else if (contentType.includes('text/')) {
            responseBody = await externalResponse.text();
        } else {
            // For binary data, convert to base64
            const buffer = await externalResponse.arrayBuffer();
            responseBody = Buffer.from(buffer).toString('base64');
        }

        const responseSize = JSON.stringify(responseBody).length;

        res.json({
            status: externalResponse.status,
            statusText: externalResponse.statusText,
            headers: responseHeaders,
            body: responseBody,
            duration,
            size: responseSize,
            success: externalResponse.ok
        });

    } catch (error) {
        console.error('Proxy error:', error);
        const duration = Date.now() - startTime;

        res.status(500).json({
            error: 'Proxy request failed',
            message: error.message,
            duration,
            success: false
        });
    }
});

module.exports = router;
