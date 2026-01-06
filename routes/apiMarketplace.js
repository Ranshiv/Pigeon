// routes/apiMarketplace.js
const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../middleware/auth');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

// Public API catalog with rich metadata
// This will be the foundation for the Explore page
const publicApiCatalog = [
    // Popular APIs
    {
        id: 'openweathermap',
        name: 'OpenWeatherMap',
        provider: 'OpenWeather',
        description: 'Current weather data, forecasts, and historical data for any location',
        category: 'Weather',
        tags: ['weather', 'forecast', 'climate', 'geolocation'],
        authType: 'API Key',
        pricing: 'Freemium',
        ratingAverage: 4.5,
        ratingCount: 12850,
        usageCount: 458920,
        baseUrl: 'https://api.openweathermap.org/data/2.5',
        logo: 'https://openweathermap.org/themes/openweathermap/assets/img/logo_white_cropped.png',
        endpoints: [
            {
                path: '/weather',
                method: 'GET',
                description: 'Get current weather data',
                parameters: [
                    { name: 'q', type: 'query', required: true, description: 'City name' },
                    { name: 'appid', type: 'query', required: true, description: 'API key' },
                    { name: 'units', type: 'query', required: false, description: 'Units (metric, imperial)' }
                ]
            },
            {
                path: '/forecast',
                method: 'GET',
                description: 'Get 5 day forecast',
                parameters: [
                    { name: 'q', type: 'query', required: true, description: 'City name' },
                    { name: 'appid', type: 'query', required: true, description: 'API key' }
                ]
            }
        ],
        documentation: 'https://openweathermap.org/api',
        featured: true,
        trending: true
    },
    {
        id: 'jsonplaceholder',
        name: 'JSONPlaceholder',
        provider: 'Typicode',
        description: 'Free fake REST API for testing and prototyping',
        category: 'Development',
        tags: ['testing', 'mock', 'placeholder', 'json'],
        authType: 'None',
        pricing: 'Free',
        ratingAverage: 4.8,
        ratingCount: 8420,
        usageCount: 892340,
        baseUrl: 'https://jsonplaceholder.typicode.com',
        endpoints: [
            {
                path: '/posts',
                method: 'GET',
                description: 'Get all posts'
            },
            {
                path: '/posts/{id}',
                method: 'GET',
                description: 'Get single post',
                parameters: [
                    { name: 'id', type: 'path', required: true, description: 'Post ID' }
                ]
            },
            {
                path: '/posts',
                method: 'POST',
                description: 'Create a post',
                body: {
                    title: 'string',
                    body: 'string',
                    userId: 'number'
                }
            }
        ],
        documentation: 'https://jsonplaceholder.typicode.com/',
        featured: true,
        trending: true
    },
    {
        id: 'restcountries',
        name: 'REST Countries',
        provider: 'REST Countries',
        description: 'Get information about countries via a RESTful API',
        category: 'Data',
        tags: ['countries', 'geography', 'flags', 'data'],
        authType: 'None',
        pricing: 'Free',
        ratingAverage: 4.7,
        ratingCount: 5630,
        usageCount: 234510,
        baseUrl: 'https://restcountries.com/v3.1',
        endpoints: [
            {
                path: '/all',
                method: 'GET',
                description: 'Get all countries'
            },
            {
                path: '/name/{name}',
                method: 'GET',
                description: 'Search by country name',
                parameters: [
                    { name: 'name', type: 'path', required: true, description: 'Country name' }
                ]
            },
            {
                path: '/alpha/{code}',
                method: 'GET',
                description: 'Search by country code',
                parameters: [
                    { name: 'code', type: 'path', required: true, description: 'Country code (2 or 3 letters)' }
                ]
            }
        ],
        documentation: 'https://restcountries.com/',
        featured: true
    },
    {
        id: 'github',
        name: 'GitHub REST API',
        provider: 'GitHub',
        description: 'Access GitHub data including repos, users, and organizations',
        category: 'Development',
        tags: ['git', 'repositories', 'code', 'version-control'],
        authType: 'OAuth 2.0',
        pricing: 'Free',
        ratingAverage: 4.9,
        ratingCount: 15420,
        usageCount: 1245680,
        baseUrl: 'https://api.github.com',
        endpoints: [
            {
                path: '/users/{username}',
                method: 'GET',
                description: 'Get a user',
                parameters: [
                    { name: 'username', type: 'path', required: true, description: 'GitHub username' }
                ]
            },
            {
                path: '/users/{username}/repos',
                method: 'GET',
                description: 'List user repositories',
                parameters: [
                    { name: 'username', type: 'path', required: true, description: 'GitHub username' }
                ]
            },
            {
                path: '/repos/{owner}/{repo}',
                method: 'GET',
                description: 'Get a repository',
                parameters: [
                    { name: 'owner', type: 'path', required: true, description: 'Repository owner' },
                    { name: 'repo', type: 'path', required: true, description: 'Repository name' }
                ]
            }
        ],
        documentation: 'https://docs.github.com/rest',
        trending: true
    },
    {
        id: 'coingecko',
        name: 'CoinGecko API',
        provider: 'CoinGecko',
        description: 'Cryptocurrency data including prices, market data, and exchange info',
        category: 'Finance',
        tags: ['cryptocurrency', 'bitcoin', 'blockchain', 'market'],
        authType: 'API Key',
        pricing: 'Freemium',
        ratingAverage: 4.6,
        ratingCount: 7830,
        usageCount: 567210,
        baseUrl: 'https://api.coingecko.com/api/v3',
        endpoints: [
            {
                path: '/ping',
                method: 'GET',
                description: 'Check API server status'
            },
            {
                path: '/simple/price',
                method: 'GET',
                description: 'Get current price of cryptocurrencies',
                parameters: [
                    { name: 'ids', type: 'query', required: true, description: 'Coin IDs (comma-separated)' },
                    { name: 'vs_currencies', type: 'query', required: true, description: 'Target currencies' }
                ]
            },
            {
                path: '/coins/markets',
                method: 'GET',
                description: 'List all supported coins with market data',
                parameters: [
                    { name: 'vs_currency', type: 'query', required: true, description: 'Target currency' }
                ]
            }
        ],
        documentation: 'https://www.coingecko.com/api/documentation',
        trending: true
    },
    {
        id: 'nasa',
        name: 'NASA APIs',
        provider: 'NASA',
        description: 'Access NASA data including astronomy pictures, Mars rover photos, and more',
        category: 'Science',
        tags: ['space', 'astronomy', 'nasa', 'images'],
        authType: 'API Key',
        pricing: 'Free',
        ratingAverage: 4.8,
        ratingCount: 9240,
        usageCount: 423180,
        baseUrl: 'https://api.nasa.gov',
        endpoints: [
            {
                path: '/planetary/apod',
                method: 'GET',
                description: 'Astronomy Picture of the Day',
                parameters: [
                    { name: 'api_key', type: 'query', required: true, description: 'NASA API key' },
                    { name: 'date', type: 'query', required: false, description: 'Date (YYYY-MM-DD)' }
                ]
            },
            {
                path: '/mars-photos/api/v1/rovers/curiosity/photos',
                method: 'GET',
                description: 'Mars Rover Photos',
                parameters: [
                    { name: 'sol', type: 'query', required: true, description: 'Martian sol' },
                    { name: 'api_key', type: 'query', required: true, description: 'NASA API key' }
                ]
            }
        ],
        documentation: 'https://api.nasa.gov/',
        featured: true
    },
    {
        id: 'newsapi',
        name: 'NewsAPI',
        provider: 'NewsAPI',
        description: 'Search and retrieve live articles from news sources and blogs',
        category: 'News',
        tags: ['news', 'articles', 'headlines', 'media'],
        authType: 'API Key',
        pricing: 'Freemium',
        ratingAverage: 4.4,
        ratingCount: 6120,
        usageCount: 289450,
        baseUrl: 'https://newsapi.org/v2',
        endpoints: [
            {
                path: '/top-headlines',
                method: 'GET',
                description: 'Get top headlines',
                parameters: [
                    { name: 'country', type: 'query', required: false, description: 'Country code' },
                    { name: 'category', type: 'query', required: false, description: 'News category' },
                    { name: 'apiKey', type: 'query', required: true, description: 'API key' }
                ]
            },
            {
                path: '/everything',
                method: 'GET',
                description: 'Search all articles',
                parameters: [
                    { name: 'q', type: 'query', required: true, description: 'Search query' },
                    { name: 'apiKey', type: 'query', required: true, description: 'API key' }
                ]
            }
        ],
        documentation: 'https://newsapi.org/docs'
    },
    {
        id: 'exchangerate',
        name: 'Exchange Rate API',
        provider: 'ExchangeRate-API',
        description: 'Real-time and historical foreign exchange rates',
        category: 'Finance',
        tags: ['currency', 'forex', 'exchange', 'rates'],
        authType: 'API Key',
        pricing: 'Freemium',
        ratingAverage: 4.5,
        ratingCount: 4890,
        usageCount: 178920,
        baseUrl: 'https://v6.exchangerate-api.com/v6',
        endpoints: [
            {
                path: '/{api_key}/latest/{base}',
                method: 'GET',
                description: 'Get latest exchange rates',
                parameters: [
                    { name: 'api_key', type: 'path', required: true, description: 'API key' },
                    { name: 'base', type: 'path', required: true, description: 'Base currency code' }
                ]
            },
            {
                path: '/{api_key}/pair/{from}/{to}',
                method: 'GET',
                description: 'Get conversion rate between two currencies',
                parameters: [
                    { name: 'api_key', type: 'path', required: true, description: 'API key' },
                    { name: 'from', type: 'path', required: true, description: 'From currency code' },
                    { name: 'to', type: 'path', required: true, description: 'To currency code' }
                ]
            }
        ],
        documentation: 'https://www.exchangerate-api.com/docs'
    },
    {
        id: 'randomuser',
        name: 'Random User Generator',
        provider: 'RandomUser.me',
        description: 'Generate random user data for testing purposes',
        category: 'Development',
        tags: ['random', 'testing', 'mock', 'users'],
        authType: 'None',
        pricing: 'Free',
        ratingAverage: 4.7,
        ratingCount: 5240,
        usageCount: 334560,
        baseUrl: 'https://randomuser.me/api',
        endpoints: [
            {
                path: '/',
                method: 'GET',
                description: 'Generate random user(s)',
                parameters: [
                    { name: 'results', type: 'query', required: false, description: 'Number of users to generate' },
                    { name: 'gender', type: 'query', required: false, description: 'Gender (male/female)' },
                    { name: 'nat', type: 'query', required: false, description: 'Nationality' }
                ]
            }
        ],
        documentation: 'https://randomuser.me/documentation',
        featured: true
    },
    {
        id: 'ipapi',
        name: 'IP-API',
        provider: 'IP-API',
        description: 'IP geolocation API for locating IP addresses',
        category: 'Data',
        tags: ['ip', 'geolocation', 'location', 'tracking'],
        authType: 'None',
        pricing: 'Freemium',
        ratingAverage: 4.3,
        ratingCount: 3670,
        usageCount: 145280,
        baseUrl: 'http://ip-api.com',
        endpoints: [
            {
                path: '/json/{ip}',
                method: 'GET',
                description: 'Get IP geolocation data',
                parameters: [
                    { name: 'ip', type: 'path', required: false, description: 'IP address (optional, uses requester IP if not provided)' }
                ]
            }
        ],
        documentation: 'https://ip-api.com/docs'
    }
];

// GET /api/marketplace/search - Search public APIs
router.get('/search', (req, res) => {
    try {
        const { query = '', category = '', tags = '', page = 1, limit = 12, sort = 'popular' } = req.query;

        let results = [...publicApiCatalog];

        // Filter by search query
        if (query) {
            const searchLower = query.toLowerCase();
            results = results.filter(api =>
                api.name.toLowerCase().includes(searchLower) ||
                api.description.toLowerCase().includes(searchLower) ||
                api.provider.toLowerCase().includes(searchLower) ||
                api.tags.some(tag => tag.toLowerCase().includes(searchLower))
            );
        }

        // Filter by category
        if (category && category !== 'All') {
            results = results.filter(api => api.category === category);
        }

        // Filter by tags
        if (tags) {
            const tagArray = tags.split(',').map(t => t.trim().toLowerCase());
            results = results.filter(api =>
                api.tags.some(tag => tagArray.includes(tag.toLowerCase()))
            );
        }

        // Sort results
        switch (sort) {
            case 'popular':
                results.sort((a, b) => b.usageCount - a.usageCount);
                break;
            case 'rating':
                results.sort((a, b) => b.ratingAverage - a.ratingAverage);
                break;
            case 'name':
                results.sort((a, b) => a.name.localeCompare(b.name));
                break;
            default:
                // Keep default order
                break;
        }

        // Pagination
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const startIndex = (pageNum - 1) * limitNum;
        const endIndex = startIndex + limitNum;
        const paginatedResults = results.slice(startIndex, endIndex);

        res.json({
            results: paginatedResults,
            total: results.length,
            page: pageNum,
            totalPages: Math.ceil(results.length / limitNum),
            hasMore: endIndex < results.length
        });
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: 'Failed to search APIs', message: error.message });
    }
});

// GET /api/marketplace/categories - Get all unique categories
router.get('/categories', (req, res) => {
    try {
        const categories = [...new Set(publicApiCatalog.map(api => api.category))].sort();
        const categoriesWithCount = categories.map(category => ({
            name: category,
            count: publicApiCatalog.filter(api => api.category === category).length
        }));

        res.json(categoriesWithCount);
    } catch (error) {
        console.error('Categories error:', error);
        res.status(500).json({ error: 'Failed to get categories', message: error.message });
    }
});

// GET /api/marketplace/tags - Get all unique tags
router.get('/tags', (req, res) => {
    try {
        const allTags = publicApiCatalog.flatMap(api => api.tags);
        const tagCounts = allTags.reduce((acc, tag) => {
            acc[tag] = (acc[tag] || 0) + 1;
            return acc;
        }, {});

        const tagsArray = Object.entries(tagCounts)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);

        res.json(tagsArray);
    } catch (error) {
        console.error('Tags error:', error);
        res.status(500).json({ error: 'Failed to get tags', message: error.message });
    }
});

// GET /api/marketplace/featured - Get featured APIs
router.get('/featured', (req, res) => {
    try {
        const featured = publicApiCatalog.filter(api => api.featured);
        res.json(featured);
    } catch (error) {
        console.error('Featured error:', error);
        res.status(500).json({ error: 'Failed to get featured APIs', message: error.message });
    }
});

// GET /api/marketplace/trending - Get trending APIs
router.get('/trending', (req, res) => {
    try {
        const trending = publicApiCatalog.filter(api => api.trending);
        res.json(trending);
    } catch (error) {
        console.error('Trending error:', error);
        res.status(500).json({ error: 'Failed to get trending APIs', message: error.message });
    }
});

// GET /api/marketplace/api/:id - Get specific API details
router.get('/api/:id', (req, res) => {
    try {
        const api = publicApiCatalog.find(a => a.id === req.params.id);
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
