// routes/apiMarketplace.js
const express = require('express');
const router = express.Router();
const MarketplaceApi = require('../models/MarketplaceApi');
const https = require('https'); // Add https to handle SSL issues
const dns = require('dns').promises;
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

function escapeRegExp(string) {
    return String(string).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function isPrivateHost(hostname) {
    if (!hostname) return true;
    const host = hostname.toLowerCase();
    if (host === 'localhost' || host.endsWith('.localhost')) return true;
    if (host === 'metadata.google.internal') return true;
    if (host.startsWith('169.254.') || host.startsWith('fe80:')) return true;
    try {
        const lookup = await dns.lookup(host, { all: true });
        return lookup.some(({ address }) => {
            return address === '127.0.0.1' || address === '::1' ||
                   address.startsWith('10.') || address.startsWith('192.168.') ||
                   /^172\.(1[6-9]|2\d|3[01])\./.test(address) ||
                   address.startsWith('169.254.') || address.startsWith('fc') ||
                   address.startsWith('fe80:') || address === '0.0.0.0';
        });
    } catch {
        return false;
    }
}

// Feature Services
const ReviewService = require('../features/api-marketplace/ReviewService');
const CommunityForums = require('../features/api-marketplace/CommunityForums');
const GuideService = require('../features/api-marketplace/GuideService');
const HealthService = require('../features/api-marketplace/HealthService');
const MarketplaceCollection = require('../server/models/MarketplaceCollection');
const MarketplacePlan = require('../server/models/MarketplacePlan');
const { incProxyCall, incReviewSubmission } = require('../middleware/metrics');
const { ensureAuthenticated } = require('../middleware/auth');
const { ensureAdmin } = require('../middleware/auth');
const { proxyLimiter } = require('../middleware/rateLimiter');
const { validateBody } = require('../middleware/validateBody');
const { z } = require('zod');

// Tier 1: zod schemas for marketplace write endpoints.
const reviewSchema = z.object({
    rating: z.number().int().min(1).max(5),
    title: z.string().trim().max(100).optional(),
    body: z.string().trim().min(1).max(2000)
});

const threadSchema = z.object({
    title: z.string().trim().min(1).max(200),
    body: z.string().trim().min(1).max(5000),
    tags: z.array(z.string()).optional()
});

const replySchema = z.object({
    body: z.string().trim().min(1)
});

const guideSchema = z.object({
    title: z.string().trim().min(1),
    slug: z.string().trim().min(1),
    summary: z.string().trim().max(300).optional(),
    contentMarkdown: z.string().trim().min(1)
});

// Tier 4: schema for a new marketplace API submission.
const submissionSchema = z.object({
    name: z.string().trim().min(1).max(120),
    provider: z.string().trim().min(1),
    description: z.string().trim().min(1).max(2000),
    category: z.string().trim().min(1),
    tags: z.array(z.string()).max(20).optional(),
    authType: z.string().optional(),
    pricing: z.string().optional(),
    baseUrl: z.string().url()
});

const moderateSchema = z.object({
    action: z.enum(['approve', 'reject'])
});

// GET /api/marketplace/search - Search public APIs
router.get('/search', async (req, res) => {
    try {
        const { query = '', category = '', tags = '', page = 1, limit = 12, sort = 'popular' } = req.query;

        // Build filter. Tier 4: only active listings are publicly searchable;
        // pending/rejected are hidden until moderated. Back-compat: existing seed
        // docs may not have a status field yet, so also include missing status.
        const filter = { $or: [{ status: 'active' }, { status: { $exists: false } }] };

        // Filter by search query. Default to Mongo $text (uses the existing text
        // index on name/description/provider/tags for relevance ranking). When
        // ?exact=1 is set, fall back to escaped-regex substring matching so a
        // query like "predict" still hits "unpredictable" (a stem $text misses).
        if (query) {
            if (req.query.exact) {
                const safeQuery = escapeRegExp(query);
                const searchRegex = new RegExp(safeQuery, 'i');
                filter.$or = [
                    { name: searchRegex },
                    { description: searchRegex },
                    { provider: searchRegex },
                    { tags: searchRegex }
                ];
            } else {
                filter.$text = { $search: query };
            }
        }

        // Filter by category
        if (category && category !== 'All') {
            filter.category = category;
        }

        // Filter by tags (exact case-insensitive match for each tag)
        if (tags) {
            const tagArray = tags.split(',').map(t => t.trim()).filter(Boolean);
            if (tagArray.length > 0) {
                filter.tags = {
                    $in: tagArray.map(t => new RegExp(`^${escapeRegExp(t)}$`, 'i'))
                };
            }
        }

        // Sort options
        let sortOption = {};
        switch (sort) {
            case 'popular':
                sortOption = { usageCount: -1 };
                break;
            case 'trending':
                sortOption = { trending: -1, usageCount: -1 };
                break;
            case 'rating':
                sortOption = { ratingAverage: -1 };
                break;
            case 'name':
                sortOption = { name: 1 };
                break;
            case 'newest':
                sortOption = { createdAt: -1 };
                break;
            default:
                sortOption = { usageCount: -1 }; // Default to popular
                break;
        }

        // Pagination
        const pageNum = Math.max(1, parseInt(page) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 12));
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

// GET /api/marketplace/trending - Get trending APIs.
// Default: return listings flagged trending (static seed value).
// ?recompute=1: derive from real signal — recent review velocity in the last
// 7 days, top N by count. ponytail: on-read recompute; switch to a node-cron
// job writing the trending flag when read throughput makes this aggregation hot.
const TrendingReview = require('../server/models/Review');
router.get('/trending', async (req, res) => {
    try {
        if (req.query.recompute) {
            const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            const top = await TrendingReview.aggregate([
                { $match: { createdAt: { $gte: since } } },
                { $group: { _id: '$listingId', recentReviews: { $sum: 1 } } },
                { $sort: { recentReviews: -1 } },
                { $limit: 20 }
            ]);
            const ids = top.map(t => t._id);
            const trending = await MarketplaceApi.find({ id: { $in: ids } });
            // Preserve aggregation order (most-recently-reviewed first).
            trending.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
            return res.json(trending);
        }
        const trending = await MarketplaceApi.find({ trending: true });
        res.json(trending);
    } catch (error) {
        console.error('Trending error:', error);
        res.status(500).json({ error: 'Failed to get trending APIs', message: error.message });
    }
});

// GET /api/marketplace/recommended-collections - curated collections from the DB.
router.get('/recommended-collections', async (req, res) => {
    try {
        const collections = await MarketplaceCollection.find()
            .sort({ stars: -1 })
            .limit(20);
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

// GET /api/marketplace/listings/pending — admin moderation queue.
// Must precede /listings/:id or Express matches "pending" as an id.
router.get('/listings/pending', ensureAuthenticated, ensureAdmin, async (req, res) => {
    try {
        const pending = await MarketplaceApi.find({ status: 'pending' })
            .sort({ createdAt: -1 })
            .limit(100);
        res.json(pending);
    } catch (err) {
        res.status(500).json({ error: 'Failed to get pending listings', message: err.message });
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

router.post('/listings/:id/reviews', ensureAuthenticated, validateBody(reviewSchema), async (req, res) => {
    try {
        const review = await ReviewService.createReview(req.params.id, req.user._id, req.body);
        incReviewSubmission();
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

router.post('/listings/:id/forums/threads', ensureAuthenticated, validateBody(threadSchema), async (req, res) => {
    try {
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

router.post('/forums/threads/:threadId/posts', ensureAuthenticated, validateBody(replySchema), async (req, res) => {
    try {
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

router.post('/listings/:id/guides', ensureAuthenticated, validateBody(guideSchema), async (req, res) => {
    try {
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

// 5. Plans — DB-backed pricing plans for a listing.
router.get('/listings/:id/plans', async (req, res) => {
    try {
        const plans = await MarketplacePlan.find({ listingId: req.params.id }).sort({ pricePerMonth: 1 });
        res.json({ enabled: true, plans });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get plans', message: error.message });
    }
});

// POST /api/marketplace/proxy - Proxy requests to external APIs (for Try It feature)
router.post('/proxy', proxyLimiter, async (req, res) => {
    const startTime = Date.now();

    try {
        const { url, method = 'GET', headers = {}, body, queryParams = {} } = req.body;

        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }

        let urlObj;
        try {
            urlObj = new URL(url);
        } catch {
            return res.status(400).json({ error: 'Invalid URL' });
        }

        // Block non-public hosts to prevent SSRF / metadata access.
        if (await isPrivateHost(urlObj.hostname)) {
            return res.status(403).json({ error: 'Proxy to private/internal hosts is not allowed' });
        }

        // Only allow http(s) schemes.
        if (!['http:', 'https:'].includes(urlObj.protocol)) {
            return res.status(400).json({ error: 'Only http and https URLs are allowed' });
        }

        // Build URL with query parameters
        Object.entries(queryParams).forEach(([key, value]) => {
            if (value) {
                urlObj.searchParams.append(key, value);
            }
        });

        // Default to verifying TLS. The user can opt-in to insecure mode for
        // testing broken certs, but never default to unsafe.
        const rejectUnauthorized = req.body.rejectUnauthorized !== undefined
            ? Boolean(req.body.rejectUnauthorized)
            : true;
        const agent = new https.Agent({ rejectUnauthorized });

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

        // Tier 2: credit the listing whose baseUrl host matches the proxied URL
        // so "popular" sort reflects real Try-It usage. Fire-and-forget; the proxy
        // response is already complete.
        try {
            await MarketplaceApi.updateOne(
                { baseUrl: { $regex: new RegExp('^[^:]+://[^/]*' + escapeRegExp(urlObj.host) + '(/|$)'), $options: 'i' } },
                { $inc: { usageCount: 1 } }
            );
        } catch (e) { /* non-fatal: usage tracking must never break the proxy */ }

        incProxyCall();
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

// --- Tier 4: Submission + Moderation ---

// POST /api/marketplace/listings — submit a new API for moderation.
// Any authenticated user may submit; the doc is created with status:'pending'.
router.post('/listings', ensureAuthenticated, validateBody(submissionSchema), async (req, res) => {
    try {
        const id = `api-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
        const doc = await MarketplaceApi.create({
            id,
            submittedBy: req.user._id,
            status: 'pending',
            ...req.body
        });
        res.status(201).json(doc);
    } catch (err) {
        res.status(500).json({ error: 'Failed to submit listing', message: err.message });
    }
});

// POST /api/marketplace/listings/:id/moderate — admin approve/reject a submission.
router.post('/listings/:id/moderate', ensureAuthenticated, ensureAdmin, validateBody(moderateSchema), async (req, res) => {
    try {
        const doc = await MarketplaceApi.findOne({ id: req.params.id });
        if (!doc) return res.status(404).json({ error: 'Listing not found' });
        doc.status = req.body.action === 'approve' ? 'active' : 'rejected';
        await doc.save();
        res.json(doc);
    } catch (err) {
        res.status(500).json({ error: 'Moderation failed', message: err.message });
    }
});

module.exports = router;
