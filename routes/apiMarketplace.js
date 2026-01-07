// routes/apiMarketplace.js
const express = require('express');
const router = express.Router();
const MarketplaceApi = require('../models/MarketplaceApi');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

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

        // Prepare fetch options
        const fetchOptions = {
            method: method.toUpperCase(),
            headers: {
                'User-Agent': 'Pigeon-API-Client/1.0',
                ...headers
            }
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
