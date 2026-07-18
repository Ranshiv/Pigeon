// tests/marketplaceApi.test.js
// End-to-end tests for the /api/marketplace explore-page APIs.
// Mounts only the marketplace router on an isolated Express app, connected to
// an in-memory MongoDB, and injects `req.user` from an `Authorization: Bearer`
// token (the "token + header" auth story the explore page relies on).

// Force production auth semantics: ensureAuthenticated must NOT stub a dev user,
// so unauthenticated write POSTs return 401 even under jest's default NODE_ENV.
process.env.NODE_ENV = 'production';
process.env.ALLOW_DEV_AUTH_STUB = 'false';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const express = require('express');

// node-fetch is loaded dynamically in the route via `import('node-fetch')`.
// Use the ESM mock registry so the route's runtime dynamic import resolves to
// our stub. Run jest with --experimental-vm-modules (see package.json test script).
let fetchMock = jest.fn();
jest.unstable_mockModule('node-fetch', async () => ({
    __esModule: true,
    default: (...args) => fetchMock(...args)
}));

const router = require('../routes/apiMarketplace');
const { resetProxyLimiter } = require('../middleware/rateLimiter');

const MarketplaceApi = require('../models/MarketplaceApi');
const User = require('../models/User');
const Review = require('../server/models/Review');
const ForumThread = require('../server/models/ForumThread');
const ForumPost = require('../server/models/ForumPost');
const Guide = require('../server/models/Guide');

let mongo;
let app;
let userId;
let authHeader;

// Minimal auth middleware: honor `Authorization: Bearer <userId>` the way the
// explore page expects a real token to carry an identity. Mirrors what passport
// would attach to req.user in production so POST review/forum/post handlers pass.
function tokenAuth(req, res, next) {
    const h = req.headers.authorization || '';
    const m = /^Bearer\s+(.+)$/i.exec(h);
    if (m && mongoose.Types.ObjectId.isValid(m[1])) {
        req.user = { _id: new mongoose.Types.ObjectId(m[1]), id: m[1], displayName: 'Tester' };
        req.isAuthenticated = () => true;
    }
    return next();
}

async function seedListing(overrides = {}) {
    return MarketplaceApi.create({
        id: overrides.id || `api-${Math.random().toString(36).slice(2, 10)}`,
        name: overrides.name || 'Test API',
        provider: overrides.provider || 'TestCo',
        description: overrides.description || 'A test description',
        category: overrides.category || 'Weather',
        tags: overrides.tags || ['rest', 'public'],
        authType: overrides.authType || 'None',
        pricing: overrides.pricing || 'Free',
        baseUrl: overrides.baseUrl || 'https://example.test',
        featured: overrides.featured || false,
        trending: overrides.trending || false,
        ...overrides
    });
}

// Silence the route's verbose [GuideService]/[DEBUG] console logs during the run
// so test output stays pristine. Restored automatically by jest's sandbox.
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});

beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri(), { serverSelectionTimeoutMS: 5000 });
    mongoose.set('bufferCommands', false);

    app = express();
    app.use(express.json());
    app.use(tokenAuth);
    app.use('/api/marketplace', router);
    // 404 fallthrough — mirrors Express default for unknown routes.
    app.use((req, res) => res.status(404).json({ error: 'Not found' }));

    const u = await User.create({
        googleId: `g-${Math.random().toString(36).slice(2, 10)}`,
        displayName: 'Tester',
        email: `tester-${Math.random().toString(36).slice(2, 8)}@pigeon.test`
    });
    userId = u._id.toString();
    authHeader = { Authorization: `Bearer ${userId}` };
}, 60000);

afterAll(async () => {
    await mongoose.disconnect();
    if (mongo) await mongo.stop();
}, 60000);

beforeEach(async () => {
    // Reset the in-memory rate-limit window so the 9 proxy tests don't trip 429.
    resetProxyLimiter();
    await Promise.all([
        MarketplaceApi.deleteMany({}),
        Review.deleteMany({}),
        ForumThread.deleteMany({}),
        ForumPost.deleteMany({}),
        Guide.deleteMany({})
    ]);
});

describe('GET /api/marketplace/search', () => {
    test('returns paginated results with metadata', async () => {
        await Promise.all([...Array(15)].map(() => seedListing()));
        const res = await request(app).get('/api/marketplace/search?page=1&limit=10');
        expect(res.status).toBe(200);
        expect(res.body.results).toHaveLength(10);
        expect(res.body.total).toBe(15);
        expect(res.body.page).toBe(1);
        expect(res.body.totalPages).toBe(2);
        expect(res.body.hasMore).toBe(true);
    });

    test('filters by category and ignores "All"', async () => {
        await seedListing({ id: 'cat-a', category: 'Weather' });
        await seedListing({ id: 'cat-b', category: 'Finance' });
        const res = await request(app).get('/api/marketplace/search?category=Weather');
        expect(res.status).toBe(200);
        expect(res.body.results.every(a => a.category === 'Weather')).toBe(true);
        expect(res.body.total).toBe(1);
    });

    test('filters by tags (comma list, case-insensitive)', async () => {
        await seedListing({ id: 't1', tags: ['Rest', 'public'] });
        await seedListing({ id: 't2', tags: ['graphql'] });
        const res = await request(app).get('/api/marketplace/search?tags=rest');
        expect(res.body.total).toBe(1);
        expect(res.body.results[0].id).toBe('t1');
    });

    test('partial query matches name/description/provider/tags', async () => {
        await seedListing({ id: 'q1', name: 'Pigeon Maps', description: 'other' });
        await seedListing({ id: 'q2', name: 'X', description: 'pigeon carrier' });
        const res = await request(app).get('/api/marketplace/search?query=pigeon');
        expect(res.body.total).toBe(2);
    });

    test('regex-injection characters in query are treated literally, not operators', async () => {
        await seedListing({ id: 'rx-safe', name: 'safe.name' });
        const res = await request(app).get('/api/marketplace/search?query=.*');
        // A literal "." + "*" should not match "safe.name" as a wildcard.
        expect(res.body.total).toBe(0);
    });

    test('clamps invalid pagination inputs to safe bounds', async () => {
        await seedListing();
        const res = await request(app).get('/api/marketplace/search?page=-3&limit=999');
        expect(res.body.page).toBe(1);
        expect(res.body.results.length).toBeLessThanOrEqual(100);
    });

    test('$text search ranks results by relevance (more mentions rank higher)', async () => {
        await seedListing({ id: 'low', name: 'Weather', description: 'a thing' });
        await seedListing({ id: 'high', name: 'Weather Pro', description: 'weather weather weather forecasts' });
        const res = await request(app).get('/api/marketplace/search?query=weather');
        expect(res.body.total).toBe(2);
        expect(res.body.results[0].id).toBe('high');
    });

    test('?exact=1 falls back to substring regex matching', async () => {
        await seedListing({ id: 'ex1', name: 'unpredictable' });
        const res = await request(app).get('/api/marketplace/search?query=predict&exact=1');
        expect(res.body.total).toBe(1);
        expect(res.body.results[0].id).toBe('ex1');
    });
});

describe('GET /api/marketplace/categories', () => {
    test('returns category aggregates with counts', async () => {
        await seedListing({ id: 'c1', category: 'Weather' });
        await seedListing({ id: 'c2', category: 'Weather' });
        await seedListing({ id: 'c3', category: 'Finance' });
        const res = await request(app).get('/api/marketplace/categories');
        expect(res.status).toBe(200);
        const weather = res.body.find(c => c.name === 'Weather');
        expect(weather.count).toBe(2);
        const finance = res.body.find(c => c.name === 'Finance');
        expect(finance.count).toBe(1);
    });
});

describe('GET /api/marketplace/tags', () => {
    test('returns tag aggregates sorted by count desc', async () => {
        await seedListing({ id: 'tg1', tags: ['hot', 'rest'] });
        await seedListing({ id: 'tg2', tags: ['hot'] });
        const res = await request(app).get('/api/marketplace/tags');
        expect(res.status).toBe(200);
        const hot = res.body.find(t => t.name === 'hot');
        expect(hot.count).toBe(2);
        // Most frequent tag first.
        expect(res.body[0].count).toBeGreaterThanOrEqual(res.body[1].count);
    });
});

describe('GET /api/marketplace/featured and /trending', () => {
    test('featured returns only featured listings', async () => {
        await seedListing({ id: 'f1', featured: true });
        await seedListing({ id: 'f2', featured: false });
        const res = await request(app).get('/api/marketplace/featured');
        expect(res.body).toHaveLength(1);
        expect(res.body[0].id).toBe('f1');
    });

    test('trending returns only listings flagged trending', async () => {
        await seedListing({ id: 'tr1', trending: true });
        await seedListing({ id: 'tr2', trending: false });
        const res = await request(app).get('/api/marketplace/trending');
        expect(res.body).toHaveLength(1);
        expect(res.body[0].id).toBe('tr1');
    });

    test('trending is recomputed from recent review velocity (high-activity listing ranks in)', async () => {
        const Review = require('../server/models/Review');
        await seedListing({ id: 'hot', trending: false });
        await seedListing({ id: 'cold', trending: true });
        // Hot listing has 3 recent reviews; cold has none.
        await Review.create([
            { listingId: 'hot', userId: userId, rating: 5, body: 'a' },
            { listingId: 'hot', userId: new mongoose.Types.ObjectId(), rating: 4, body: 'b' },
            { listingId: 'hot', userId: new mongoose.Types.ObjectId(), rating: 4, body: 'c' }
        ]);
        const res = await request(app).get('/api/marketplace/trending?recompute=1');
        const ids = res.body.map(a => a.id);
        expect(ids).toContain('hot');
    });
});

describe('GET /api/marketplace/recommended-collections', () => {
    test('returns the static curated collection list', async () => {
        const res = await request(app).get('/api/marketplace/recommended-collections');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThanOrEqual(1);
        expect(res.body[0]).toHaveProperty('name');
    });
});

describe('GET /api/marketplace/api/:id and /listings/:id', () => {
    test('returns the listing by string id', async () => {
        await seedListing({ id: 'detail-1', name: 'Detail' });
        const res = await request(app).get('/api/marketplace/api/detail-1');
        expect(res.status).toBe(200);
        expect(res.body.name).toBe('Detail');
    });

    test('returns 404 for unknown id', async () => {
        const res = await request(app).get('/api/marketplace/api/does-not-exist');
        expect(res.status).toBe(404);
        expect(res.body.error).toBe('API not found');
    });

    test('/listings/:id is an alias returning the same payload', async () => {
        await seedListing({ id: 'alias-1', name: 'Alias' });
        const res = await request(app).get('/api/marketplace/listings/alias-1');
        expect(res.status).toBe(200);
        expect(res.body.name).toBe('Alias');
    });

    test('/listings redirect to search preserves query params', async () => {
        await seedListing();
        const res = await request(app).get('/api/marketplace/listings?category=Weather');
        expect(res.status).toBeGreaterThanOrEqual(300);
        expect(res.status).toBeLessThan(400);
        expect(res.headers.location).toContain('/api/marketplace/search');
        expect(res.headers.location).toContain('category=Weather');
    });
});

describe('Reviews', () => {
    test('GET reviews returns empty aggregate for new listing', async () => {
        await seedListing({ id: 'rev-1' });
        const res = await request(app).get('/api/marketplace/listings/rev-1/reviews');
        expect(res.status).toBe(200);
        expect(res.body.total).toBe(0);
        expect(res.body.items).toHaveLength(0);
        expect(res.body).toHaveProperty('aggregate');
    });

    test('POST review without auth token returns 401', async () => {
        await seedListing({ id: 'rev-2' });
        const res = await request(app)
            .post('/api/marketplace/listings/rev-2/reviews')
            .send({ rating: 5, title: 'Great', body: 'Loved it' });
        expect(res.status).toBe(401);
    });

    test('POST review with Bearer token creates review and updates aggregate', async () => {
        await seedListing({ id: 'rev-3' });
        const res = await request(app)
            .post('/api/marketplace/listings/rev-3/reviews')
            .set(authHeader)
            .send({ rating: 4, title: 'Good', body: 'Solid API' });
        expect(res.status).toBe(200);
        expect(res.body.rating).toBe(4);
        expect(res.body.listingId).toBe('rev-3');

        const list = await request(app).get('/api/marketplace/listings/rev-3/reviews');
        expect(list.body.total).toBe(1);
    });

    test('POST review with out-of-range rating returns 400', async () => {
        await seedListing({ id: 'rev-4' });
        const res = await request(app)
            .post('/api/marketplace/listings/rev-4/reviews')
            .set(authHeader)
            .send({ rating: 9, body: 'Bad rating' });
        expect(res.status).toBe(400);
    });

    test('POST review missing body field returns 400', async () => {
        await seedListing({ id: 'rev-5' });
        const res = await request(app)
            .post('/api/marketplace/listings/rev-5/reviews')
            .set(authHeader)
            .send({ rating: 5 });
        expect(res.status).toBe(400);
    });
});

describe('Community forums', () => {
    test('GET threads returns paginated empty list', async () => {
        await seedListing({ id: 'forum-1' });
        const res = await request(app).get('/api/marketplace/listings/forum-1/forums/threads');
        expect(res.status).toBe(200);
        expect(res.body.total).toBe(0);
    });

    test('POST thread without auth returns 401', async () => {
        await seedListing({ id: 'forum-2' });
        const res = await request(app)
            .post('/api/marketplace/listings/forum-2/forums/threads')
            .send({ title: 'Hello', body: 'World' });
        expect(res.status).toBe(401);
    });

    test('POST thread missing title returns 400 even when authed', async () => {
        await seedListing({ id: 'forum-2b' });
        const res = await request(app)
            .post('/api/marketplace/listings/forum-2b/forums/threads')
            .set(authHeader)
            .send({ body: 'no title here' });
        expect(res.status).toBe(400);
    });

    test('POST thread with token seeds an opening post, GET thread returns it with posts[0]', async () => {
        await seedListing({ id: 'forum-3' });
        const created = await request(app)
            .post('/api/marketplace/listings/forum-3/forums/threads')
            .set(authHeader)
            .send({ title: 'My Thread', body: 'First post', tags: ['q'] });
        expect(created.status).toBe(200);
        const threadId = created.body._id;

        const got = await request(app).get(`/api/marketplace/forums/threads/${threadId}`);
        expect(got.status).toBe(200);
        expect(got.body.thread._id).toBe(threadId);
        // createThread seeds the opening body as the first ForumPost.
        expect(got.body.posts).toHaveLength(1);
        expect(got.body.posts[0].body).toBe('First post');
        expect(got.body.thread.replyCount).toBeGreaterThanOrEqual(1);
    });

    test('GET unknown thread returns 404', async () => {
        const fake = new mongoose.Types.ObjectId();
        const res = await request(app).get(`/api/marketplace/forums/threads/${fake}`);
        expect(res.status).toBe(404);
    });

    test('POST reply without auth returns 401', async () => {
        await seedListing({ id: 'forum-4' });
        const t = await request(app)
            .post('/api/marketplace/listings/forum-4/forums/threads')
            .set(authHeader)
            .send({ title: 'T', body: 'B' });
        const res = await request(app)
            .post(`/api/marketplace/forums/threads/${t.body._id}/posts`)
            .send({ body: 'reply' });
        expect(res.status).toBe(401);
    });

    test('POST reply with token creates post and bumps replyCount', async () => {
        await seedListing({ id: 'forum-5' });
        const t = await request(app)
            .post('/api/marketplace/listings/forum-5/forums/threads')
            .set(authHeader)
            .send({ title: 'T', body: 'B' });
        const res = await request(app)
            .post(`/api/marketplace/forums/threads/${t.body._id}/posts`)
            .set(authHeader)
            .send({ body: 'a reply' });
        expect(res.status).toBe(200);
        expect(res.body.body).toBe('a reply');
        const got = await request(app).get(`/api/marketplace/forums/threads/${t.body._id}`);
        expect(got.body.thread.replyCount).toBe(2);
    });
});

describe('Guides', () => {
    test('GET guides seeds a default guide when none exist', async () => {
        await seedListing({ id: 'guide-1', name: 'Guide API' });
        const res = await request(app).get('/api/marketplace/listings/guide-1/guides');
        expect(res.status).toBe(200);
        expect(res.body.length).toBeGreaterThanOrEqual(1);
        expect(res.body[0]).toHaveProperty('slug');
    });

    test('GET guide by slug returns content, 404 when missing', async () => {
        await seedListing({ id: 'guide-2', name: 'Guide API' });
        const list = await request(app).get('/api/marketplace/listings/guide-2/guides');
        const slug = list.body[0].slug;
        const ok = await request(app).get(`/api/marketplace/listings/guide-2/guides/${slug}`);
        expect(ok.status).toBe(200);
        expect(ok.body).toHaveProperty('contentMarkdown');

        const missing = await request(app).get('/api/marketplace/listings/guide-2/guides/nope-slug');
        expect(missing.status).toBe(404);
    });

    test('POST guide without auth token returns 401', async () => {
        await seedListing({ id: 'guide-3a' });
        const res = await request(app)
            .post('/api/marketplace/listings/guide-3a/guides')
            .send({ title: 'Custom', slug: 'custom', contentMarkdown: '# hi', summary: 's' });
        expect(res.status).toBe(401);
    });

    test('POST guide with token creates a guide', async () => {
        await seedListing({ id: 'guide-3' });
        const res = await request(app)
            .post('/api/marketplace/listings/guide-3/guides')
            .set(authHeader)
            .send({ title: 'Custom', slug: 'custom', contentMarkdown: '# hi', summary: 's' });
        expect(res.status).toBe(200);
        expect(res.body.slug).toBe('custom');
    });

    test('POST guide missing contentMarkdown returns 400 even when authed', async () => {
        await seedListing({ id: 'guide-3b' });
        const res = await request(app)
            .post('/api/marketplace/listings/guide-3b/guides')
            .set(authHeader)
            .send({ title: 'No body', slug: 'no-body' });
        expect(res.status).toBe(400);
    });
});

describe('Health and plans', () => {
    test('GET health returns a deterministic status payload', async () => {
        await seedListing({ id: 'health-1' });
        const res = await request(app).get('/api/marketplace/listings/health-1/health');
        expect(res.status).toBe(200);
        expect(res.body.current).toHaveProperty('score');
        expect(res.body.current).toHaveProperty('status');
    });

    test('GET plans returns the static mock plans', async () => {
        await seedListing({ id: 'plans-1' });
        const res = await request(app).get('/api/marketplace/listings/plans-1/plans');
        expect(res.status).toBe(200);
        expect(res.body.enabled).toBe(true);
        expect(res.body.plans.length).toBeGreaterThanOrEqual(2);
    });
});

describe('POST /api/marketplace/proxy (Try It)', () => {
    afterEach(() => {
        fetchMock.mockClear();
    });

    test('rejects when url missing', async () => {
        const res = await request(app).post('/api/marketplace/proxy').send({});
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/URL is required/i);
    });

    test('rejects invalid url', async () => {
        const res = await request(app).post('/api/marketplace/proxy').send({ url: 'not-a-url' });
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/Invalid URL/i);
    });

    test('blocks non-http schemes (ftp)', async () => {
        const res = await request(app).post('/api/marketplace/proxy').send({ url: 'ftp://example.test' });
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/http and https/i);
    });

    test('blocks SSRF to private/internal hosts (localhost)', async () => {
        const res = await request(app).post('/api/marketplace/proxy').send({ url: 'http://localhost:8080' });
        expect(res.status).toBe(403);
        expect(res.body.error).toMatch(/private|internal/i);
    });

    test('forwards a public GET request and returns decoded body + duration', async () => {
        fetchMock.mockResolvedValueOnce({
            ok: true,
            status: 200,
            statusText: 'OK',
            headers: new Map([['content-type', 'application/json']]),
            json: async () => ({ hello: 'world' }),
            text: async () => '',
            arrayBuffer: async () => new ArrayBuffer(0)
        });
        const res = await request(app)
            .post('/api/marketplace/proxy')
            .send({ url: 'https://api.public.test/v1', method: 'GET', headers: { 'X-Token': 'abc' } });
        expect(res.status).toBe(200);
        expect(res.body.status).toBe(200);
        expect(res.body.body).toEqual({ hello: 'world' });
        expect(res.body.success).toBe(true);
        expect(typeof res.body.duration).toBe('number');
        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [calledUrl, opts] = fetchMock.mock.calls[0];
        expect(calledUrl).toContain('https://api.public.test/v1');
        expect(opts.headers['X-Token']).toBe('abc');
        expect(opts.headers['User-Agent']).toMatch(/Pigeon-API-Client/);
    });

    test('serializes JSON body for POST and sets Content-Type', async () => {
        fetchMock.mockResolvedValueOnce({
            ok: true, status: 201, statusText: 'Created',
            headers: new Map([['content-type', 'text/plain']]),
            json: async () => ({}), text: async () => 'created', arrayBuffer: async () => new ArrayBuffer(0)
        });
        await request(app)
            .post('/api/marketplace/proxy')
            .send({ url: 'https://api.public.test/v1', method: 'POST', body: { x: 1 } });
        const opts = fetchMock.mock.calls[0][1];
        expect(opts.method).toBe('POST');
        expect(opts.body).toBe(JSON.stringify({ x: 1 }));
        expect(opts.headers['Content-Type']).toBe('application/json');
    });

    test('increments listing usageCount after a successful proxy call', async () => {
        await seedListing({ id: 'usage-1', usageCount: 5, baseUrl: 'https://api.public.test' });
        fetchMock.mockResolvedValueOnce({
            ok: true, status: 200, statusText: 'OK',
            headers: new Map([['content-type', 'application/json']]),
            json: async () => ({}), text: async () => '', arrayBuffer: async () => new ArrayBuffer(0)
        });
        const res = await request(app)
            .post('/api/marketplace/proxy')
            .send({ url: 'https://api.public.test/v1' });
        expect(res.status).toBe(200);
        const after = await MarketplaceApi.findOne({ id: 'usage-1' }).lean();
        expect(after.usageCount).toBe(6);
    });
});

describe('Ghost endpoints (defined on client, not on router)', () => {
    test('/listings/:id/examples returns 404', async () => {
        await seedListing({ id: 'ghost-1' });
        const res = await request(app).get('/api/marketplace/listings/ghost-1/examples');
        expect(res.status).toBe(404);
    });

    test('/listings/:id/publish POST returns 404', async () => {
        await seedListing({ id: 'ghost-2' });
        const res = await request(app).post('/api/marketplace/listings/ghost-2/publish');
        expect(res.status).toBe(404);
    });
});
