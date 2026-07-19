// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');
const cookieParser = require('cookie-parser');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const http = require('http');
const path = require('path');
const mongoose = require('mongoose');
const axios = require('axios'); // Add axios import for proxy functionality
const https = require('https'); // Add https to handle SSL issues
const { mountSecurityMiddleware, globalErrorHandler } = require('./middleware/securityMiddleware');
const { metricsHandler } = require('./middleware/metrics');
const { initializeConnections } = require('./config/db');
const User = require('./models/User');
const MarketplaceApi = require('./models/MarketplaceApi');
const { initializeSocketServer } = require('./utils/socket/socket-server');

// Import monitoring service
const MonitoringService = require('./services/monitoring/MonitoringService');

// Import analytics scheduler
const AnalyticsScheduler = require('./services/AnalyticsScheduler');

// Import all routes from the central routes module
const routes = require('./routes');

// Create Express app and HTTP server
const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 5001;

// Socket.io is initialized only when the server actually starts listening.
// This keeps Jest/supertest imports side-effect free and prevents open handles.

// NOTE: DB connections and server listening are started only when this file is executed
// directly (node server.js). This keeps Jest/supertest imports side-effect free.

// --- MIDDLEWARE (Correct Order) ---
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));
mountSecurityMiddleware(app);
app.use(express.json());
app.use(cookieParser());

// Tier 4: Redis-backed sessions when REDIS_URL is set (multi-node deployments).
// ponytail: on a single node, fall back to MemoryStore — do not pay Redis
// latency until horizontal scale needs shared sessions.
let sessionStore;
if (process.env.REDIS_URL) {
    const redis = require('redis');
    const { RedisStore } = require('connect-redis');
    const redisClient = redis.createClient({ url: process.env.REDIS_URL });
    redisClient.connect().catch(err => console.error('Redis session store connect failed:', err.message));
    sessionStore = new RedisStore({ client: redisClient });
}

app.use(session({
    secret: process.env.SESSION_SECRET || 'keyboard cat',
    resave: false,
    saveUninitialized: false,
    ...(sessionStore ? { store: sessionStore } : {}),
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));
app.use(passport.initialize());
app.use(passport.session());

function ensureDatabaseReady(req, res, next) {
    // Keep health endpoint available for diagnostics even when DB is down.
    if (req.path === '/health') {
        return next();
    }

    if (mongoose.connection.readyState !== 1) {
        return res.status(503).json({
            error: true,
            message: 'Database is not connected. Please try again shortly.',
            dbState: mongoose.connection.readyState
        });
    }

    next();
}

// --- SSRF GUARD ---
// Block requests to private/internal IPs and link-local cloud metadata endpoints.
// /api/proxy makes arbitrary outbound requests; without this, an unauthenticated
// caller can read internal services (169.254.169.254 metadata, 10.x, 127.x, etc.).
const dns = require('dns').promises;
async function isPrivateHost(hostname) {
    if (!hostname) return true;
    const host = hostname.toLowerCase();
    if (host === 'localhost' || host.endsWith('.localhost')) return true;
    if (host === 'metadata.google.internal') return true;
    // Link-local / metadata
    if (host.startsWith('169.254.') || host.startsWith('fe80:')) return true;
    // Resolve and check resolved IPs (covers DNS that points inward)
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
        return false; // let axios surface the real DNS error
    }
}

// --- PASSPORT CONFIGURATION ---
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${process.env.API_URL || 'http://localhost:5001'}/auth/google/callback`,
    scope: ['profile', 'email', 'https://mail.google.com/'], // Add Gmail scope for sending emails
    accessType: 'offline', // Request refresh token
    prompt: 'consent' // Force consent screen to get refresh token
},
    async (accessToken, refreshToken, profile, cb) => {
        try {
            // Find user by Google ID
            let user = await User.findOne({ googleId: profile.id });

            if (user) {
                // Update existing user info
                user.displayName = profile.displayName || user.displayName;
                user.email = profile.emails?.[0]?.value || user.email;
                user.profilePicture = profile.photos?.[0]?.value || user.profilePicture;
                user.lastLogin = new Date();

                // Store OAuth tokens for email sending
                user.accessToken = accessToken;
                if (refreshToken) {
                    user.refreshToken = refreshToken; // Only update if provided (Google doesn't always send it)
                }
                // Access tokens expire in 1 hour
                user.tokenExpiry = new Date(Date.now() + 3600 * 1000);

                await user.save();
            } else {
                // Create a new user
                user = new User({
                    googleId: profile.id,
                    displayName: profile.displayName,
                    email: profile.emails?.[0]?.value,
                    profilePicture: profile.photos?.[0]?.value,
                    theme: 'light',
                    fontSize: '16px',
                    lastLogin: new Date(),
                    // Store OAuth tokens for email sending
                    accessToken: accessToken,
                    refreshToken: refreshToken,
                    tokenExpiry: new Date(Date.now() + 3600 * 1000) // 1 hour
                });
                await user.save();
            }
            return cb(null, user);
        } catch (err) {
            console.error("Error in Google Strategy:", err);
            return cb(err, null);
        }
    }
));

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});

// --- Use the central routes with /api prefix ---
app.use('/api', ensureDatabaseReady, routes);

// --- PROMETHEUS METRICS ---
app.get('/metrics', metricsHandler);

// --- HEALTH CHECK ENDPOINT ---
app.get('/api/health', (req, res) => {
    const dbStates = ['disconnected', 'connected', 'connecting', 'disconnecting'];
    res.json({
        status: 'ok',
        service: 'pigeon-api',
        timestamp: new Date(),
        database: {
            readyState: mongoose.connection.readyState,
            status: dbStates[mongoose.connection.readyState] || 'unknown'
        },
        features: {
            linting: 'enabled',
            visualization: 'enabled',
            collaboration: 'enabled'
        }
    });
});

// --- GLOBAL ERROR HANDLER (must be last) ---
app.use(globalErrorHandler);


// --- GOOGLE AUTH ROUTES ---
app.get('/auth/google',
    (req, res, next) => {
        console.log("Reached /auth/google route handler!");
        passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next)
    });

app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/' }),
    (req, res) => {
        // Successful authentication, redirect to the workspace.
        // `+` binds tighter than `||`, so parenthesize so /workspace always appends.
        res.redirect((process.env.FRONTEND_URL || 'http://localhost:3000') + '/workspace');
    }
);

// OAuth 2.0 callback route for API authentication
app.get('/oauth/callback', (req, res) => {
    // Serve the OAuth callback HTML page
    res.sendFile(path.join(__dirname, 'client', 'public', 'oauth-callback.html'));
});

// --- API Cache and Popular APIs ---
// Cache for API data
let apiCache = {
    data: [],
    lastUpdated: null
};

// Function to fetch and cache APIs from Database
async function fetchAndCacheAPIs() {
    try {
        console.log('Fetching APIs from database to initialize cache...');

        // Fetch all APIs from the MarketplaceApi collection
        const apis = await MarketplaceApi.find({});

        if (apis.length === 0) {
            console.log('No APIs found in database. Please run the seed script.');
            // Fallback to a few essential ones if DB is empty, but we should really use the seed script
            apiCache.data = [];
        } else {
            // Transform model data to the format expected by the frontend if necessary
            apiCache.data = apis.map(api => ({
                id: api.id,
                name: api.name,
                description: api.description,
                category: api.category,
                url: api.baseUrl, // Map baseUrl to url for frontend compatibility
                auth: api.authType !== 'None' ? 'Required' : 'None',
                https: true, // Standard for most APIs now
                cors: "yes", // Most public APIs we've curated support CORS
                documentation: api.documentation,
                featured: api.featured,
                trending: api.tags.includes('trending') || api.trending
            }));
            console.log(`API cache initialized with ${apiCache.data.length} APIs from database`);
        }

        apiCache.lastUpdated = new Date();
    } catch (error) {
        console.error('Error initializing API cache from database:', error);
    }
}

// Initial fetch
setTimeout(() => {
    fetchAndCacheAPIs();
}, 5000); // Give database connection some time to stabilize

// Search endpoint for APIs
app.get('/api/search', async (req, res) => {
    try {
        const { query, category } = req.query;

        // Using database for real-time search if possible, or fallback to cache
        let results = [];

        if (query || (category && category !== 'all')) {
            const filter = {};
            if (query) {
                // Escape user input before building a RegExp — raw metachars
                // cause ReDoS (catastrophic backtracking) and pattern injection.
                const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const searchRegex = new RegExp(escaped, 'i');
                filter.$or = [
                    { name: searchRegex },
                    { description: searchRegex },
                    { category: searchRegex },
                    { tags: searchRegex }
                ];
            }
            if (category && category !== 'all') {
                filter.category = category;
            }

            const dbApis = await MarketplaceApi.find(filter);
            results = dbApis.map(api => ({
                id: api.id,
                name: api.name,
                description: api.description,
                category: api.category,
                url: api.baseUrl,
                auth: api.authType !== 'None' ? 'Required' : 'None',
                https: true,
                cors: "yes",
                documentation: api.documentation
            }));
        } else {
            // Return from cache if no search criteria
            if (!apiCache.data || apiCache.data.length === 0) {
                await fetchAndCacheAPIs();
            }
            results = apiCache.data;
        }

        res.json(results);
    } catch (err) {
        console.error('Search error:', err);
        res.status(500).json({ message: err.message });
    }
});

// Add a test endpoint for testing pre-request and test scripts
app.get('/api/test-endpoint', (req, res) => {
    const query = req.query;
    const headers = req.headers;

    // Simulate different responses based on query parameters
    let statusCode = parseInt(query.status) || 200;
    let delay = parseInt(query.delay) || 0;

    // Allow testing different response types
    let responseType = query.responseType || 'json';
    let responseData;

    switch (responseType) {
        case 'json':
            responseData = {
                message: "This is a JSON response",
                query: query,
                headers: headers,
                timestamp: new Date().toISOString()
            };
            break;
        case 'text':
            responseData = "This is a plain text response.\nTimestamp: " + new Date().toISOString();
            res.type('text/plain');
            break;
        case 'xml':
            responseData = `<?xml version="1.0" encoding="UTF-8"?>
<response>
    <message>This is an XML response</message>
    <timestamp>${new Date().toISOString()}</timestamp>
</response>`;
            res.type('application/xml');
            break;
        case 'error':
            statusCode = 500;
            responseData = {
                error: "This is a simulated error response",
                code: "SIM_ERROR",
                timestamp: new Date().toISOString()
            };
            break;
        default:
            responseData = { message: "Unknown response type requested" };
    }

    // Simulate delay if requested
    setTimeout(() => {
        res.status(statusCode).send(responseData);
    }, delay);
});

// Add mock API endpoints for CLI testing
app.get('/api/cli-test/users/me', (req, res) => {
    // Check for API key
    const apiKey = req.header('Authorization');
    if (!apiKey || !apiKey.startsWith('Bearer ')) {
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Missing or invalid API key'
        });
    }

    res.json({
        id: "user-123",
        name: "Test User",
        email: "user@example.com",
        role: "tester",
        createdAt: new Date().toISOString()
    });
});

app.post('/api/cli-test/items', (req, res) => {
    // Check for API key
    const apiKey = req.header('Authorization');
    if (!apiKey || !apiKey.startsWith('Bearer ')) {
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Missing or invalid API key'
        });
    }

    // Create a new item with the data from the request
    const newItem = {
        id: "item-" + Date.now(),
        ...req.body,
        createdAt: new Date().toISOString()
    };

    res.status(201).json(newItem);
});

app.get('/api/cli-test/items/:id', (req, res) => {
    // Check for API key
    const apiKey = req.header('Authorization');
    if (!apiKey || !apiKey.startsWith('Bearer ')) {
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Missing or invalid API key'
        });
    }

    // Return the item with the provided ID
    res.json({
        id: req.params.id,
        name: "Test Item",
        description: "Created through CI/CD pipeline tests",
        userId: req.query.userId || "user-123",
        createdAt: new Date().toISOString()
    });
});

app.delete('/api/cli-test/items/:id', (req, res) => {
    // Check for API key
    const apiKey = req.header('Authorization');
    if (!apiKey || !apiKey.startsWith('Bearer ')) {
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Missing or invalid API key'
        });
    }

    // Successful deletion - no content
    res.status(204).send();
});

// --- Add the proxy endpoint for making external API requests and mock server support ---
app.post('/api/proxy', async (req, res) => {
    // Debug logging setup - declare these at function scope
    const { url, method, headers, body, timeout, mockServerId, debug, debugSessionId } = req.body;
    const debugLogs = [];
    const isDebugging = debug === true;

    const addDebugLog = (level, message, data = null) => {
        if (isDebugging) {
            debugLogs.push({
                timestamp: new Date().toISOString(),
                level: level,
                message: message,
                data: data,
                sessionId: debugSessionId
            });
            console.log(`[DEBUG:${debugSessionId}] ${level.toUpperCase()}: ${message}`, data || '');
        }
    };

    try {
        if (!url) {
            return res.status(400).json({
                error: true,
                message: 'URL is required',
                debugLogs: isDebugging ? debugLogs : undefined
            });
        }

        // SSRF guard: block internal/private/metadata targets and non-http(s) schemes.
        let parsedTarget;
        try {
            parsedTarget = new URL(url);
        } catch {
            return res.status(400).json({ error: true, message: 'Invalid URL' });
        }
        if (parsedTarget.protocol !== 'http:' && parsedTarget.protocol !== 'https:') {
            return res.status(400).json({ error: true, message: 'Only http/https URLs are allowed' });
        }
        if (await isPrivateHost(parsedTarget.hostname)) {
            return res.status(403).json({ error: true, message: 'Requests to private/internal hosts are blocked' });
        }

        if (isDebugging) {
            addDebugLog('info', `Starting proxy request: ${method || 'GET'} ${url}`);
            addDebugLog('debug', `Debug session: ${debugSessionId}`);
            addDebugLog('debug', `Request headers:`, headers);
            if (body) {
                addDebugLog('debug', `Request body:`, body);
            }
        }

        // Check if this is a mock server request
        if (mockServerId) {
            if (isDebugging) {
                addDebugLog('info', `Mock server request detected: ${mockServerId}`);
            }

            try {
                const MockServerService = require('./services/MockServerService');

                // Extract path from URL
                const urlObj = new URL(url);
                const path = urlObj.pathname;

                if (isDebugging) {
                    addDebugLog('debug', `Mock server path: ${path}`);
                }

                const mockResponse = await MockServerService.handleMockRequest(
                    mockServerId,
                    path,
                    method || 'GET',
                    urlObj.searchParams,
                    body,
                    headers || {}
                );

                if (isDebugging) {
                    addDebugLog('success', `Mock response generated: ${mockResponse.status}`);
                    addDebugLog('debug', `Mock response body:`, mockResponse.body);
                }

                return res.json({
                    status: mockResponse.status,
                    statusText: 'OK',
                    headers: mockResponse.headers,
                    body: mockResponse.body,
                    size: JSON.stringify(mockResponse.body).length,
                    isMock: true,
                    debugLogs: isDebugging ? debugLogs : undefined
                });
            } catch (mockError) {
                console.error('Mock server error:', mockError);

                if (isDebugging) {
                    addDebugLog('error', `Mock server error: ${mockError.message}`, { error: mockError.message });
                }

                return res.status(500).json({
                    error: true,
                    message: `Mock server error: ${mockError.message}`,
                    isMock: true,
                    debugLogs: isDebugging ? debugLogs : undefined
                });
            }
        }

        console.log(`Proxy request: ${method || 'GET'} ${url}`);

        if (isDebugging) {
            addDebugLog('info', `Making external API request to: ${url}`);
        }

        // Prepare headers with default User-Agent if not provided
        const requestHeaders = { ...headers } || {};
        if (!requestHeaders['User-Agent'] && !requestHeaders['user-agent']) {
            requestHeaders['User-Agent'] = 'Pigeon API Client/1.0';
        }

        if (isDebugging) {
            addDebugLog('debug', `Final request headers:`, requestHeaders);
            addDebugLog('debug', `Request timeout: ${timeout || 30000}ms`);
        }

        // Track request timing
        const requestStartTime = Date.now();

        // Always enforce TLS certificate validation — letting the client
        // pass rejectUnauthorized:false enables MITM downgrades via the proxy.
        const httpsAgent = new https.Agent({
            rejectUnauthorized: true
        });

        // Make the request with enhanced options
        const response = await axios({
            url,
            method: method || 'GET',
            headers: requestHeaders,
            data: body || null,
            timeout: timeout || 30000,
            maxRedirects: 5,
            validateStatus: () => true, // Don't throw errors on non-2xx responses
            decompress: true, // Handle gzipped responses
            responseType: 'json', // Default to JSON response
            httpsAgent: httpsAgent
        });

        const requestEndTime = Date.now();
        const requestDuration = requestEndTime - requestStartTime;

        if (isDebugging) {
            addDebugLog('info', `Request completed in ${requestDuration}ms`);
            addDebugLog('success', `Response status: ${response.status} ${response.statusText}`);
            addDebugLog('debug', `Response headers:`, response.headers);
            addDebugLog('debug', `Response size: ${response.data ? JSON.stringify(response.data).length : 0} bytes`);
        }

        // Handle 403 Forbidden specifically
        if (response.status === 403) {
            console.log('Received 403 Forbidden response:', url);

            if (isDebugging) {
                addDebugLog('warn', `403 Forbidden response from ${url}`);
            }

            // Provide helpful error information
            let errorTips = [
                "The API might require authentication",
                "Check if an API key is required in headers or query parameters",
                "Some APIs restrict access based on IP address or origin",
                "The API might have rate limiting in place"
            ];

            // Check response for specific error messages
            let errorDetails = '';
            if (response.data) {
                if (typeof response.data === 'string') {
                    errorDetails = response.data;
                } else if (typeof response.data === 'object') {
                    errorDetails = JSON.stringify(response.data);
                }
            }

            if (isDebugging) {
                addDebugLog('debug', `403 error details:`, errorDetails);
                addDebugLog('info', `Suggested solutions:`, errorTips);
            }

            return res.json({
                status: 403,
                statusText: 'Forbidden',
                error: true,
                headers: response.headers,
                body: response.data,
                size: response.data ? JSON.stringify(response.data).length : 0,
                errorTips: errorTips,
                errorDetails: errorDetails,
                debugLogs: isDebugging ? debugLogs : undefined
            });
        }

        // Return a standardized response format for all other responses
        res.json({
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
            body: response.data,
            size: response.data ? JSON.stringify(response.data).length : 0,
            debugLogs: isDebugging ? debugLogs : undefined
        });

    } catch (err) {
        console.error('Proxy error:', err.message);

        if (isDebugging) {
            addDebugLog('error', `Proxy request failed: ${err.message}`, {
                error: err.message,
                code: err.code,
                stack: err.stack
            });
        }

        // Determine error type for better error messages
        let errorMessage = err.message;
        let errorTips = [];

        if (err.code === 'ENOTFOUND') {
            errorMessage = `Domain not found: ${err.hostname}`;
            errorTips = [
                "Check if the API URL is correct",
                "Verify your internet connection",
                "The API server might be down"
            ];
        } else if (err.message && err.message.includes('certificate has expired')) {
            errorMessage = `SSL Certificate Expired: The API at ${url} has an expired security certificate.`;
            errorTips = [
                "The API provider needs to renew their SSL certificate",
                "You can try to disable 'SSL Verification' in the request settings if available",
                "Try using http instead of https if the provider supports it"
            ];
        } else if (err.code === 'ECONNREFUSED') {
            errorMessage = `Connection refused to ${err.address}:${err.port}`;
            errorTips = [
                "The API server might be down or not accepting connections",
                "Check if you're using the correct port"
            ];
        } else if (err.code === 'ETIMEDOUT') {
            errorMessage = `Connection timed out to ${err.address}`;
            errorTips = [
                "The API server might be slow or overloaded",
                "Try increasing the timeout value"
            ];
        } else if (err.response && err.response.status === 403) {
            errorMessage = `Forbidden: Access to ${err.response.config.url} was denied`;
            errorTips = [
                "The API might require authentication",
                "Check if an API key is required",
                "Some APIs restrict access based on IP address or origin"
            ];
        }

        if (isDebugging) {
            addDebugLog('debug', `Error analysis: ${errorMessage}`, { errorTips });
        }

        res.status(err.response?.status || 500).json({
            error: true,
            status: err.response?.status || 0,
            statusText: err.response?.statusText || 'Error',
            message: errorMessage,
            errorTips: errorTips,
            headers: err.response?.headers || {},
            body: err.response?.data || `Request failed: ${errorMessage}`,
            debugLogs: isDebugging ? debugLogs : undefined
        });
    }
});

// --- STARTUP ---
async function startServer() {
    try {
        await initializeConnections();
        console.log('Database connections initialized successfully');
    } catch (err) {
        console.error('Failed to initialize database connections', err);
        process.exit(1);
    }

    // Initialize socket.io server (after middleware/routes are registered, before listen)
    initializeSocketServer(server);

    server.listen(port, () => {
        console.log('\n' + '='.repeat(60));
        console.log('🕊️  PIGEON API MONITOR');
        console.log('='.repeat(60));
        console.log(`✅ Server listening on port ${port}`);
        console.log(`📡 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
        console.log(`🗄️  Database: ${process.env.MONGODB_URI ? 'Connected' : 'Using default'}`);

        // Email service status
        console.log(`📧 Email: OAuth2 enabled (users send from their Gmail)`);
        if (process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
            console.log(`   ↳ SMTP Fallback: Configured (${process.env.EMAIL_USER})`);
        } else {
            console.log('   ↳ SMTP Fallback: Not configured');
        }
        console.log('   💡 Tip: Configure email in your deployment environment variables (OAuth2/SMTP/Brevo)');

        console.log('='.repeat(60) + '\n');

        // Start monitoring service after server is ready
        setTimeout(() => {
            console.log('🔍 Starting monitoring service...');
            MonitoringService.start();

            console.log('📊 Starting analytics scheduler...');
            AnalyticsScheduler.start();

            console.log('\n✨ All systems operational!\n');
        }, 2000); // Give server 2 seconds to fully initialize
    });
}

if (require.main === module) {
    startServer();
}

module.exports = app;
module.exports.server = server;

// --- Browser Console Capture API Endpoints ---
const BrowserConsoleService = require('./services/BrowserConsoleService');

// Console-capture runs puppeteer + new Function(script) in a real browser —
// effectively RCE. Local single-user deployment: restrict to localhost callers.
function localhostOnly(req, res, next) {
    const ip = req.ip || req.socket?.remoteAddress || '';
    const v4 = ip.replace(/^::ffff:/, '');
    if (v4 === '127.0.0.1' || v4 === '::1' || v4 === '::') return next();
    return res.status(403).json({ error: true, message: 'Console capture is only available from localhost' });
}

// Method guidance for browser/manual navigation
app.get('/api/console-capture/start', (req, res) => {
    res.status(405).json({
        error: true,
        message: 'Use POST /api/console-capture/start with JSON body: { sessionId, url }'
    });
});

// Start browser console capture for a website
app.post('/api/console-capture/start', localhostOnly, async (req, res) => {
    try {
        const { sessionId, url } = req.body;

        if (!sessionId || !url) {
            return res.status(400).json({
                error: true,
                message: 'sessionId and url are required'
            });
        }

        // Block non-http(s) schemes — puppeteer page.goto('file:///...') would
        // let a caller read local files via the server.
        let captureUrl;
        try { captureUrl = new URL(url); } catch { return res.status(400).json({ error: true, message: 'Invalid URL' }); }
        if (captureUrl.protocol !== 'http:' && captureUrl.protocol !== 'https:') {
            return res.status(400).json({ error: true, message: 'Only http/https URLs are allowed' });
        }

        console.log(`Starting console capture for ${url} (session: ${sessionId})`);

        // Create callback to send logs to VisualizationDebugger
        const callback = (logEntry) => {
            // This could be extended to send via WebSocket for real-time updates
            console.log(`Console Log [${logEntry.type}]:`, logEntry.message);
        };

        const result = await BrowserConsoleService.startCapture(sessionId, url, callback);

        res.json(result);
    } catch (error) {
        console.error('Console capture start error:', error);
        res.status(500).json({
            error: true,
            message: error.message
        });
    }
});

// Get recent console logs from a capture session
app.get('/api/console-capture/:sessionId/logs', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const since = parseInt(req.query.since) || 0;

        const allLogs = BrowserConsoleService.getSessionLogs(sessionId);

        // Filter logs by timestamp if 'since' parameter is provided
        const filteredLogs = since > 0
            ? allLogs.filter(log => new Date(log.timestamp).getTime() > since)
            : allLogs;

        res.json({
            success: true,
            sessionId,
            logs: filteredLogs,
            totalLogs: allLogs.length,
            isActive: BrowserConsoleService.activeSessions.has(sessionId)
        });
    } catch (error) {
        console.error('Console capture logs error:', error);
        res.status(500).json({
            error: true,
            message: error.message
        });
    }
});

// Stop console capture for a session
app.post('/api/console-capture/:sessionId/stop', localhostOnly, async (req, res) => {
    try {
        const { sessionId } = req.params;

        const result = await BrowserConsoleService.stopCapture(sessionId);
        res.json(result);
    } catch (error) {
        console.error('Console capture stop error:', error);
        res.status(500).json({
            error: true,
            message: error.message
        });
    }
});

// Execute script in captured page
app.post('/api/console-capture/:sessionId/execute', localhostOnly, async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { script, waitMs = 500 } = req.body;

        if (!script) {
            return res.status(400).json({
                error: true,
                message: 'script is required'
            });
        }

        const result = await BrowserConsoleService.executeScript(sessionId, script, waitMs);

        if (!result.success) {
            const statusCode = result.error === 'Session not found' ? 404 : 400;
            return res.status(statusCode).json({
                error: true,
                message: result.error,
                sessionId
            });
        }

        res.json(result);
    } catch (error) {
        console.error('Console capture execute error:', error);
        res.status(500).json({
            error: true,
            message: error.message
        });
    }
});

// Get all active console capture sessions
app.get('/api/console-capture/sessions', (req, res) => {
    try {
        const sessions = BrowserConsoleService.getActiveSessions();
        res.json({
            success: true,
            sessions
        });
    } catch (error) {
        console.error('Console capture sessions error:', error);
        res.status(500).json({
            error: true,
            message: error.message
        });
    }
});

// Graceful shutdown — single handler for SIGTERM/SIGINT.
// BrowserConsoleService.cleanup() is async (await it); its own module-level
// SIGINT/SIGTERM handlers were removed to avoid racing this one.
async function shutdown(signal) {
    console.log(`${signal} received, shutting down gracefully`);
    MonitoringService.stop();
    AnalyticsScheduler.stop();
    try { await BrowserConsoleService.cleanup(); } catch (e) { console.error('cleanup error:', e.message); }
    server.close(() => {
        console.log('Process terminated');
        process.exit(0);
    });
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));