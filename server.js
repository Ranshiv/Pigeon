// server.js
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const session = require('express-session');
const cookieParser = require('cookie-parser');
require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const Request = require('./models/Request');
const axios = require('axios');
const http = require('http'); // Add http for socket.io
const socketIo = require('socket.io'); // Add socket.io
const { MongoClient, ObjectId } = require('mongodb'); // MongoDB imports

const app = express();
const server = http.createServer(app); // Create HTTP server
const io = socketIo(server, { // Initialize socket.io
    cors: {
        origin: "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
    }
});

const port = process.env.PORT || 5001;

const User = require('./models/User');
const History = require('./models/History');
// Add global environment store (add this after other requires)
const userEnvironments = {}; // Store environment variables by user ID
// Import the scriptRunner utility
const { executePreRequestScript, executeTestScript } = require('./utils/scriptRunner');

// MongoDB connection URI and DB name
const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const dbName = process.env.DB_NAME || 'pigeon_db';

// Create MongoDB client
const client = new MongoClient(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// Database reference
let db;

// Connect to MongoDB
async function connectToDatabase() {
    try {
        await client.connect();
        console.log('Connected to MongoDB');
        db = client.db(dbName);

        // Ensure indexes for better performance
        await db.collection('workspaces').createIndex({ owner: 1 });
        await db.collection('collections').createIndex({ workspaceId: 1 });
        await db.collection('collections').createIndex({ owner: 1 });
    } catch (err) {
        console.error('Failed to connect to MongoDB:', err);
    }
}

// Call the connection function
connectToDatabase();

// These in-memory stores will be removed and replaced with MongoDB
// Keep them temporarily for backward compatibility
const workspacesStore = {};
const collectionsStore = {};

// Add a counter for generating unique IDs
let collectionIdCounter = 100;
// --- MIDDLEWARE (Correct Order) ---
app.use(cors({
    origin: 'http://localhost:3000', // Your frontend's URL
    credentials: true, // Allow sending cookies
}));
app.use(express.json());
app.use(cookieParser());
app.use(session({
    secret: process.env.SESSION_SECRET, // Use a STRONG secret from .env!
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production', // HTTPS in production
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));
app.use(passport.initialize());
app.use(passport.session());

// Add this near the top of the file with other middleware functions
const ensureAuthenticated = (req, res, next) => {
    // For development purposes: automatically authenticate all requests
    // This allows workspace functionality to work properly
    req.isAuthenticated = () => true;
    if (!req.user) {
        req.user = {
            id: "temp-user-id",
            name: "Temporary User",
            email: "temp@example.com",
            displayName: "Temporary User"
        };
    }
    return next();
};

// Add this after your other middleware definitions, before your routes
// JWT Authentication middleware
const authenticateJWT = (req, res, next) => {
    // For development purposes, we'll auto-authenticate
    // In a production environment, this would verify a JWT token
    if (!req.user) {
        req.user = {
            id: "temp-user-id",
            name: "Temporary User",
            email: "temp@example.com",
            displayName: "Temporary User"
        };
    }
    return next();
};

// --- DATABASE CONNECTION ---
mongoose.connect(process.env.DATABASE_URL)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('Could not connect to MongoDB', err));

// --- PASSPORT CONFIGURATION ---
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: 'http://localhost:5001/auth/google/callback',
    scope: ['profile', 'email']
},
    async (accessToken, refreshToken, profile, cb) => { // Make the callback async
        try {
            // Find user by Google ID
            let user = await User.findOne({ googleId: profile.id });

            if (user) {
                // User exists, return the user
                return cb(null, user);
            } else {
                // User doesn't exist, create a new user
                const newUser = new User({
                    googleId: profile.id,
                    displayName: profile.displayName,
                    email: profile.emails[0].value,
                    // You might want to add profile picture logic here too
                });
                await newUser.save();
                return cb(null, newUser);
            }
        } catch (err) {
            console.error("Error in Google Strategy:", err);
            return cb(err, null);
        }
    }
));


passport.serializeUser((user, done) => {
    done(null, user.id); // Store only the user ID in the session
});

passport.deserializeUser(async (id, done) => { // Make deserializeUser async
    try {
        const user = await User.findById(id);
        done(null, user); // Find user by ID and attach to req.user
    } catch (err) {
        done(err, null);
    }
});



// --- AUTHENTICATION ROUTES (BEFORE other API routes) ---

app.get('/auth/google',
    (req, res, next) => {
        console.log("Reached /auth/google route handler!"); // Debugging log
        passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next)
    });

app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/' }), // Redirect to public home on failure
    (req, res) => {
        // Successful authentication, redirect to the workspace.
        res.redirect('http://localhost:3000/workspace');
    }
);

app.get('/api/auth/check', (req, res) => {
    if (req.isAuthenticated()) {
        res.json({ isAuthenticated: true, user: req.user });
    } else {
        res.json({ isAuthenticated: false });
    }
});

app.get('/api/auth/logout', (req, res) => {
    req.logout((err) => {
        if (err) {
            console.error("Logout error:", err);
            return res.status(500).json({ message: 'Logout failed' });
        }
        req.session.destroy((err) => {
            if (err) {
                console.error('Session destruction error: ', err)
                return res.status(500).json({ message: 'Logout Failed' })
            }
            res.clearCookie('connect.sid'); // Clear the session cookie
            res.json({ message: 'Logged out successfully' });
        });
    });
});

// --- Profile Update Route ---
// server.js (Modified PUT /api/user/profile route)

// Define allowed icon filenames (for validation) - should match your files
const allowedIcons = [
    'buffalo.png', 'clown-fish.png', 'hippo.png',
    'lion.png', 'mouse.png', 'pig.png', 'sheep.png'
];

app.put('/api/user/profile', ensureAuthenticated, async (req, res) => {
    try {
        // Include profileIcon
        const { displayName, theme, fontSize, profileIcon } = req.body;
        const userId = req.user.id;

        const updateData = {};
        if (displayName && typeof displayName === 'string' && displayName.trim() !== '') {
            updateData.displayName = displayName.trim();
        }
        if (theme && ['light', 'dark'].includes(theme)) {
            updateData.theme = theme;
        }
        if (fontSize && ['14px', '16px', '18px'].includes(fontSize)) {
            updateData.fontSize = fontSize;
        }
        // Validate and add profileIcon
        if (profileIcon && typeof profileIcon === 'string') {
            if (allowedIcons.includes(profileIcon)) {
                updateData.profileIcon = profileIcon;
            } else {
                console.warn(`Invalid profileIcon received: ${profileIcon}`);
                // Optionally return a specific error, or just ignore it
                // return res.status(400).json({ message: 'Invalid profile icon selected' });
            }
        }

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ message: 'No valid fields provided for update' });
        }

        const updatedUser = await User.findByIdAndUpdate(userId, updateData, { new: true });

        if (!updatedUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        req.login(updatedUser, (err) => {
            if (err) {
                console.error("Error updating session user after profile update:", err);
            }
            res.json({ message: 'Profile updated successfully', user: updatedUser });
        });

    } catch (err) {
        console.error("Error updating profile:", err);
        res.status(500).json({ message: 'Error updating profile' });
    }
});
// --- OTHER API ROUTES ---
app.post('/api/requests', async (req, res) => {
    try {
        const newRequest = new Request(req.body);
        const savedRequest = await newRequest.save();
        res.status(201).json(savedRequest);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Get a specific request by ID
app.get('/api/requests/:id', async (req, res) => {
    try {
        const request = await Request.findById(req.params.id);
        if (!request) {
            return res.status(404).json({ message: 'Request not found' });
        }
        res.json(request);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Update a specific request by ID
app.put('/api/requests/:id', async (req, res) => {
    try {
        const updatedRequest = await Request.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedRequest) {
            return res.status(404).json({ message: 'updated Request not found' });
        }
        res.json(updatedRequest);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Delete a specific request by ID
app.delete('/api/requests/:id', async (req, res) => {
    try {
        const deletedRequest = await Request.findByIdAndDelete(req.params.id);
        if (!deletedRequest) {
            return res.status(404).json({ message: 'Request not found' });
        }
        res.json({ message: 'Request deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Get all requests
app.get('/api/requests', async (req, res) => {
    try {
        const requests = await Request.find();
        res.json(requests);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Send the request and get the response
app.post('/api/requests/:id/send', ensureAuthenticated, async (req, res) => { // Added ensureAuthenticated
    const startTime = Date.now();
    let responseStatus, responseStatusText, responseHeadersObj, responseBodyText, responseSize, isJson = false; // Define vars here
    let testResults = [];

    // Get or initialize user's environment store
    const userId = req.user.id;
    if (!userEnvironments[userId]) {
        userEnvironments[userId] = {};
    }
    const userEnv = userEnvironments[userId];

    try {
        const requestDoc = await Request.findById(req.params.id);
        if (!requestDoc) {
            return res.status(404).json({ message: 'Request not found' });
        }

        const { url, method, headers, body, bodyType, preRequestScript, testScript } = requestDoc;

        // --- Prepare and Send Fetch Request ---
        const fetchOptions = {
            method,
            headers: headers.reduce((acc, { name, value }) => {
                if (name && value) acc[name] = value; // Avoid adding empty headers
                return acc;
            }, {}),
            timeout: 30000, // Example: 30 second timeout
        };

        if (body && bodyType !== 'none') {
            // Set Content-Type based on bodyType if not already set
            let contentTypeHeader = Object.keys(fetchOptions.headers).find(h => h.toLowerCase() === 'content-type');
            if (!contentTypeHeader) {
                if (bodyType === 'json') contentTypeHeader = 'application/json';
                else if (bodyType === 'x-www-form-urlencoded') contentTypeHeader = 'application/x-www-form-urlencoded';
                // Add other types if needed (e.g., text/plain)
                if (contentTypeHeader) fetchOptions.headers['Content-Type'] = contentTypeHeader;
            }

            if (bodyType === 'json') {
                // Ensure body is valid JSON string before sending
                try {
                    JSON.parse(body); // Validate
                    fetchOptions.body = body;
                } catch (parseError) {
                    throw new Error("Invalid JSON in request body");
                }
            } else if (bodyType === 'x-www-form-urlencoded') {
                try {
                    const parsedBody = JSON.parse(body); // Assume body is stored as JSON string for key-value pairs
                    fetchOptions.body = new URLSearchParams(parsedBody).toString();
                } catch (parseError) {
                    throw new Error("Invalid key-value format for x-www-form-urlencoded body (expected JSON string)");
                }
            } else { // raw, text, etc.
                fetchOptions.body = body;
            }
        }

        // --- Execute Pre-request Script with user environment ---
        let requestWithScriptChanges = { url, ...fetchOptions };
        let updatedEnv = { ...userEnv };

        if (preRequestScript) {
            console.log("Executing pre-request script...");
            const preRequestResult = executePreRequestScript(preRequestScript, requestWithScriptChanges, userEnv);

            if (preRequestResult.error) {
                console.error("Pre-request script error:", preRequestResult.error);
                // Continue with request, but log the error
            } else {
                // Apply any changes from the pre-request script
                requestWithScriptChanges = preRequestResult.request;
                updatedEnv = preRequestResult.environment;

                // Update environment
                userEnvironments[userId] = updatedEnv;
                console.log("Updated environment after pre-request script:", Object.keys(updatedEnv));

                // Update request options based on pre-request script changes
                fetchOptions.headers = requestWithScriptChanges.headers || fetchOptions.headers;
                fetchOptions.body = requestWithScriptChanges.body || fetchOptions.body;

                // Handle variables set by pre-request script
                if (requestWithScriptChanges.variables && requestWithScriptChanges.variables.values) {
                    // Apply variables to URL
                    let modifiedUrl = url;
                    for (const [key, value] of Object.entries(requestWithScriptChanges.variables.values)) {
                        const pattern = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
                        modifiedUrl = modifiedUrl.replace(pattern, value);
                    }
                    // Use the modified URL
                    requestWithScriptChanges.url = modifiedUrl;
                }
            }
        }

        const externalResponse = await fetch(requestWithScriptChanges.url || url, fetchOptions);
        const duration = Date.now() - startTime;

        // --- Process Response ---
        responseStatus = externalResponse.status;
        responseStatusText = externalResponse.statusText;
        responseHeadersObj = {};
        externalResponse.headers.forEach((value, name) => {
            responseHeadersObj[name] = value;
        });
        responseBodyText = await externalResponse.text();
        responseSize = Buffer.byteLength(responseBodyText, 'utf8'); // Approximate size

        let parsedResponseBody = responseBodyText;
        const contentType = responseHeadersObj['content-type']?.toLowerCase() || '';
        if (contentType.includes('application/json')) {
            try {
                parsedResponseBody = JSON.parse(responseBodyText);
                isJson = true;
            } catch (e) {
                console.warn("Failed to parse JSON response body");
                isJson = false; // Treat as text if parsing fails
            }
        }

        // --- Execute Test Script with user environment ---
        if (testScript) {
            console.log("Executing test script...");
            const responseForTesting = {
                status: responseStatus,
                statusText: responseStatusText,
                headers: responseHeadersObj,
                body: parsedResponseBody,
                duration: duration,
                size: responseSize
            };

            const testScriptResult = executeTestScript(testScript, responseForTesting, userEnv);

            if (testScriptResult.error) {
                console.error("Test script error:", testScriptResult.error);
                // Add the error as a test result
                testResults = [{
                    name: "Test Script Error",
                    passed: false,
                    error: testScriptResult.error.message,
                    timestamp: Date.now()
                }];
            } else {
                testResults = testScriptResult.results || [];
                // Update environment after test script
                userEnvironments[userId] = testScriptResult.environment;
                console.log("Updated environment after test script:", Object.keys(testScriptResult.environment));
            }
        }

        // --- Send Response to Frontend ---
        const frontendResponse = {
            status: responseStatus,
            statusText: responseStatusText,
            headers: responseHeadersObj,
            body: parsedResponseBody,
            isJson: isJson, // Send flag to frontend
            duration: duration,
            size: responseSize,
            testResults: testResults.length > 0 ? testResults : null
        };
        res.json(frontendResponse);

        // --- Save History (After Sending Response) ---
        try {
            const historyEntry = new History({
                userId: req.user.id, // Associate with logged-in user
                url: requestWithScriptChanges.url || url,
                method: method,
                requestHeaders: JSON.stringify(fetchOptions.headers), // Store headers used
                requestBody: fetchOptions.body || '', // Store body sent
                requestBodyType: bodyType,
                responseStatus: responseStatus,
                responseStatusText: responseStatusText,
                responseHeaders: JSON.stringify(responseHeadersObj),
                responseBody: responseBodyText, // Store raw text body
                isJson: isJson,
                timestamp: new Date(startTime), // Use the start time
                duration: duration,
                size: responseSize,
                originalRequestId: requestDoc._id, // Link to the saved request
                // Save test results if available
                testResults: testResults.length > 0 ? JSON.stringify(testResults) : null
            });
            await historyEntry.save();
            console.log("History entry saved for request ID:", requestDoc._id);
        } catch (historyError) {
            console.error("Error saving history entry:", historyError);
            // Log the error, but don't fail the main request
        }

    } catch (err) {
        const duration = Date.now() - startTime;
        console.error("Error during external fetch or processing:", err);
        // Send an error response to the frontend
        res.status(500).json({
            error: `Error sending request: ${err.message}`, // Send error message
            status: 500, // Indicate server-side error during send
            statusText: 'Server Error',
            headers: {},
            body: null,
            duration: duration,
            testResults: null
        });

        // --- Optionally save failed attempt to History ---
        try {
            const historyEntry = new History({
                userId: req.user.id,
                url: req.params.id ? (await Request.findById(req.params.id))?.url || 'Unknown URL' : 'Unknown URL', // Attempt to get URL
                method: req.params.id ? (await Request.findById(req.params.id))?.method || 'Unknown Method' : 'Unknown Method', // Attempt to get method
                responseStatus: 500, // Indicate internal error
                responseStatusText: 'Server Error During Send',
                responseBody: `Error: ${err.message}`,
                timestamp: new Date(startTime),
                duration: duration,
                originalRequestId: req.params.id || null
            });
            await historyEntry.save();
            console.log("Failed history entry saved for request ID:", req.params.id);
        } catch (failedHistoryError) {
            console.error("Error saving FAILED history entry:", failedHistoryError);
        }
    }
});

// --- NEW: History Route with parsed test results ---
app.get('/api/history', ensureAuthenticated, async (req, res) => {
    try {
        const history = await History.find({ userId: req.user.id })
            .sort({ timestamp: -1 }) // Sort by newest first
            .limit(50); // Limit to latest 50 entries (for now)

        // Parse test results JSON strings into objects for the frontend
        const historyWithParsedTests = history.map(entry => {
            const historyObj = entry.toObject();
            if (historyObj.testResults && typeof historyObj.testResults === 'string') {
                try {
                    historyObj.testResults = JSON.parse(historyObj.testResults);
                } catch (err) {
                    console.error("Error parsing test results for history entry:", err);
                    historyObj.testResults = null;
                }
            }
            return historyObj;
        });

        res.json(historyWithParsedTests);
    } catch (err) {
        console.error("Error fetching history:", err);
        res.status(500).json({ message: 'Error fetching history', error: err.message });
    }
});

// Cache for API data
let apiCache = {
    data: [],
    lastUpdated: null
};

// Function to fetch and cache APIs
async function fetchAndCacheAPIs() {
    try {
        console.log('Initializing API cache...');

        // Using curated list of APIs
        apiCache.data = [
            {
                name: "GitHub REST API",
                description: "Access GitHub's features and data programmatically",
                category: "Development",
                url: "https://api.github.com",
                auth: "OAuth",
                https: true,
                cors: "yes",
                documentation: "https://docs.github.com/rest"
            },
            {
                name: "WeatherAPI",
                description: "Real-Time Weather API with historical weather information",
                category: "Weather",
                url: "https://api.weatherapi.com/v1",
                auth: "apiKey",
                https: true,
                cors: "yes",
                documentation: "https://www.weatherapi.com/docs/"
            },
            {
                name: "NASA API",
                description: "Access NASA space data, including Mars rover photos and astronomy pictures",
                category: "Science",
                url: "https://api.nasa.gov",
                auth: "apiKey",
                https: true,
                cors: "yes",
                documentation: "https://api.nasa.gov/"
            },
            {
                name: "CoinGecko",
                description: "Comprehensive cryptocurrency data API",
                category: "Finance",
                url: "https://api.coingecko.com/api/v3",
                auth: "none",
                https: true,
                cors: "yes",
                documentation: "https://www.coingecko.com/api/documentation"
            },
            {
                name: "Movie Database (TMDB)",
                description: "Movie and TV show data, including ratings, reviews, and cast information",
                category: "Entertainment",
                url: "https://api.themoviedb.org/3",
                auth: "apiKey",
                https: true,
                cors: "yes",
                documentation: "https://developers.themoviedb.org/3"
            },
            {
                name: "Dog API",
                description: "Dog breeds, images, and facts",
                category: "Animals",
                url: "https://dog.ceo/api",
                auth: "none",
                https: true,
                cors: "yes",
                documentation: "https://dog.ceo/dog-api/"
            },
            {
                name: "Spotify Web API",
                description: "Music catalog, playback control, and user data",
                category: "Music",
                url: "https://api.spotify.com/v1",
                auth: "OAuth",
                https: true,
                cors: "yes",
                documentation: "https://developer.spotify.com/documentation/web-api"
            }
        ];
        apiCache.lastUpdated = new Date();
        console.log(`API cache initialized with ${apiCache.data.length} APIs`);
    } catch (error) {
        console.error('Error initializing API cache:', error);
    }
}

// Initial fetch
fetchAndCacheAPIs();

// Search endpoint for APIs
app.get('/api/search', async (req, res) => {
    try {
        const { query, category } = req.query;

        // If cache is empty, initialize it
        if (!apiCache.data || apiCache.data.length === 0) {
            await fetchAndCacheAPIs();
        }

        // Search in cached APIs
        let results = apiCache.data;

        if (query) {
            const searchQuery = query.toLowerCase();
            results = results.filter(api =>
                api.name.toLowerCase().includes(searchQuery) ||
                api.description.toLowerCase().includes(searchQuery) ||
                api.category.toLowerCase().includes(searchQuery)
            );
        }

        if (category && category !== 'all') {
            results = results.filter(api =>
                api.category.toLowerCase() === category.toLowerCase()
            );
        }

        // Sort results by relevance (name matches first)
        if (query) {
            const searchQuery = query.toLowerCase();
            results.sort((a, b) => {
                const aNameMatch = a.name.toLowerCase().includes(searchQuery);
                const bNameMatch = b.name.toLowerCase().includes(searchQuery);
                if (aNameMatch && !bNameMatch) return -1;
                if (!aNameMatch && bNameMatch) return 1;
                return 0;
            });
        }

        res.json(results);
    } catch (err) {
        console.error('Search error:', err);
        res.status(500).json({ message: err.message });
    }
});

// Get popular APIs (most used in the last week)
app.get('/api/popular-apis', ensureAuthenticated, async (req, res) => {
    try {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        const popularAPIs = await History.aggregate([
            {
                $match: {
                    timestamp: { $gte: oneWeekAgo }
                }
            },
            {
                $group: {
                    _id: {
                        url: "$url",
                        method: "$method"
                    },
                    count: { $sum: 1 },
                    lastUsed: { $max: "$timestamp" }
                }
            },
            {
                $sort: { count: -1 }
            },
            {
                $limit: 5
            }
        ]);

        res.json(popularAPIs);
    } catch (err) {
        console.error('Error fetching popular APIs:', err);
        res.status(500).json({ message: 'Error fetching popular APIs' });
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
                message: "This is a test response",
                timestamp: new Date().toISOString(),
                echo: {
                    query: query,
                    headers: headers
                }
            };
            break;
        case 'text':
            responseData = "This is a plain text response. Timestamp: " + new Date().toISOString();
            res.type('text/plain');
            break;
        case 'xml':
            responseData = `<?xml version="1.0" encoding="UTF-8"?>
<response>
    <message>This is a test XML response</message>
    <timestamp>${new Date().toISOString()}</timestamp>
</response>`;
            res.type('application/xml');
            break;
        case 'error':
            statusCode = 500;
            responseData = { error: "This is a simulated error" };
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

// --- WORKSPACE ROUTES ---
// This should be added before the app.listen line

// Get all workspaces
app.get('/api/workspaces', ensureAuthenticated, async (req, res) => {
    try {
        const userId = req.user.id;

        // Fetch workspaces from MongoDB
        const workspaces = await db.collection('workspaces')
            .find({
                $or: [
                    { owner: userId },
                    { "collaborators.userId": userId }
                ]
            })
            .toArray();

        // Separate into personal and team workspaces
        const personalWorkspaces = [];
        const teamWorkspaces = [];

        for (const workspace of workspaces) {
            // Convert MongoDB ObjectId to string for client use
            const wsWithStringId = {
                ...workspace,
                _id: workspace._id.toString()
            };

            // Add collection count information
            const collectionsCount = await db.collection('collections')
                .countDocuments({ workspaceId: workspace._id.toString() });

            wsWithStringId.collectionsCount = collectionsCount;
            wsWithStringId.collaboratorsCount = workspace.collaborators ? workspace.collaborators.length : 1;

            // Add to appropriate array
            if (workspace.isPersonal) {
                personalWorkspaces.push(wsWithStringId);
            } else {
                teamWorkspaces.push(wsWithStringId);
            }

            // For backward compatibility, also update the in-memory store
            workspacesStore[workspace._id.toString()] = {
                name: workspace.name,
                description: workspace.description || "",
                isPersonal: workspace.isPersonal || false,
                isPublic: workspace.isPublic || false
            };
        }

        // Add default workspace if none exist
        if (personalWorkspaces.length === 0 && teamWorkspaces.length === 0) {
            // Create a default workspace in MongoDB
            const defaultWorkspace = {
                name: "API Testing",
                description: "Workspace for API testing and documentation",
                isPersonal: true,
                isPublic: false,
                owner: userId,
                userRole: "admin",
                collaborators: [
                    {
                        userId: userId,
                        displayName: req.user.name || "User",
                        email: req.user.email,
                        role: "admin",
                        joinedAt: new Date()
                    }
                ],
                createdAt: new Date(),
                updatedAt: new Date()
            };

            const result = await db.collection('workspaces').insertOne(defaultWorkspace);
            defaultWorkspace._id = result.insertedId.toString();
            defaultWorkspace.collectionsCount = 0;
            defaultWorkspace.collaboratorsCount = 1;

            personalWorkspaces.push(defaultWorkspace);

            // Update in-memory store as well
            workspacesStore[defaultWorkspace._id] = {
                name: defaultWorkspace.name,
                description: defaultWorkspace.description,
                isPersonal: defaultWorkspace.isPersonal,
                isPublic: defaultWorkspace.isPublic
            };
        }

        res.json({
            personal: personalWorkspaces,
            team: teamWorkspaces
        });
    } catch (err) {
        console.error("Error fetching workspaces:", err);
        res.status(500).json({ message: 'Error fetching workspaces' });
    }
});

// Get workspaces shared with the user - IMPORTANT: Place this before the /:id route to avoid path conflicts
app.get('/api/workspaces/shared', ensureAuthenticated, async (req, res) => {
    try {
        // Mock shared workspaces data
        const sharedWorkspaces = {
            personal: [
                {
                    _id: "shared_ws1",
                    name: "Alex's Personal Workspace",
                    description: "Personal workspace shared by Alex",
                    isPersonal: true,
                    isPublic: false,
                    owner: "alex-user-id",
                    userRole: "Viewer",
                    createdAt: new Date(),
                    collaboratorsCount: 2,
                    collectionsCount: 3
                }
            ],
            team: [
                {
                    _id: "shared_ws2",
                    name: "Marketing Team",
                    description: "Workspace for our marketing initiatives",
                    isPersonal: false,
                    isPublic: false,
                    owner: "sarah-user-id",
                    userRole: "Editor",
                    createdAt: new Date(),
                    collaboratorsCount: 8,
                    collectionsCount: 12
                },
                {
                    _id: "shared_ws3",
                    name: "Product Development",
                    description: "Workspace for product development and testing",
                    isPersonal: false,
                    isPublic: false,
                    owner: "mike-user-id",
                    userRole: "Contributor",
                    createdAt: new Date(),
                    collaboratorsCount: 6,
                    collectionsCount: 15
                }
            ]
        };

        res.json(sharedWorkspaces);
    } catch (err) {
        console.error("Error fetching shared workspaces:", err);
        res.status(500).json({ message: 'Error fetching shared workspaces' });
    }
});

// Get a specific workspace by ID (this should come AFTER the /api/workspaces/shared route)
app.get('/api/workspaces/:id', ensureAuthenticated, async (req, res) => {
    try {
        const workspaceId = req.params.id;
        const userId = req.user.id;

        // Special handling for "my-workspace" - redirect to personal workspace
        if (workspaceId === 'my-workspace') {
            // Return the user's personal workspace (ws1)
            const personalWorkspaceId = "ws1";

            if (workspacesStore[personalWorkspaceId]) {
                const storedWorkspace = workspacesStore[personalWorkspaceId];

                const workspace = {
                    _id: personalWorkspaceId,
                    name: storedWorkspace.name,
                    description: storedWorkspace.description,
                    isPersonal: true,
                    isPublic: false,
                    owner: userId,
                    userRole: "admin",
                    memberCount: 1,
                    collectionCount: 2,
                    collaborators: [
                        {
                            userId: userId,
                            displayName: req.user.name || "User",
                            email: req.user.email,
                            role: "admin",
                            joinedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                        }
                    ],
                    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                    updatedAt: new Date()
                };

                return res.json(workspace);
            }
        }

        // Continue with normal workspace lookup for other workspace IDs
        // Check if this is a workspace we've seen before
        let workspace;

        // Use the stored workspace data if it exists
        if (workspacesStore[workspaceId]) {
            // Use the stored name and description
            const storedWorkspace = workspacesStore[workspaceId];

            workspace = {
                _id: workspaceId,
                name: storedWorkspace.name,
                description: storedWorkspace.description,
                isPersonal: storedWorkspace.isPersonal,
                isPublic: storedWorkspace.isPublic,
                owner: userId,
                userRole: "admin", // Assuming the requester is the admin/owner
                memberCount: workspaceId === "ws1" ? 1 : 5,
                collectionCount: workspaceId === "ws1" ? 2 : 4,
                collaborators: [
                    {
                        userId: userId,
                        displayName: req.user.name || "User",
                        email: req.user.email,
                        role: "admin",
                        joinedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 days ago
                    }
                ],
                createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
                updatedAt: new Date()
            };
        } else {
            // This is a new workspace - provide default values
            return res.status(404).json({ message: 'Workspace not found' });
        }

        res.json(workspace);
    } catch (err) {
        console.error("Error fetching workspace:", err);
        res.status(500).json({ message: 'Error fetching workspace' });
    }
});

// Get collections for a workspace - Updated to use MongoDB
app.get('/api/workspaces/:id/collections', ensureAuthenticated, async (req, res) => {
    try {
        const workspaceId = req.params.id;

        // Fetch collections from MongoDB
        const collections = await db.collection('collections')
            .find({ workspaceId: workspaceId })
            .toArray();

        // For backward compatibility, also update the in-memory store
        if (!collectionsStore[workspaceId]) {
            collectionsStore[workspaceId] = [];
        }

        // Update the in-memory store with MongoDB data
        collectionsStore[workspaceId] = collections.map(collection => ({
            ...collection,
            _id: collection._id.toString() // Convert ObjectId to string for memory store
        }));

        // Return collections with string IDs for client-side use
        const collectionsWithStringIds = collections.map(collection => ({
            ...collection,
            _id: collection._id.toString() // Convert ObjectId to string for client use
        }));

        res.json(collectionsWithStringIds);
    } catch (err) {
        console.error("Error fetching workspace collections:", err);
        res.status(500).json({ message: 'Error fetching workspace collections' });
    }
});

// Get merge requests for a workspace
app.get('/api/workspaces/:id/merge-requests', ensureAuthenticated, async (req, res) => {
    try {
        // Mock empty merge requests array
        const mergeRequests = [];

        res.json(mergeRequests);
    } catch (err) {
        console.error("Error fetching merge requests:", err);
        res.status(500).json({ message: 'Error fetching merge requests' });
    }
});

// Get activity for a workspace
app.get('/api/workspaces/:id/activity', ensureAuthenticated, async (req, res) => {
    try {
        // Mock empty activity array
        const activities = [];

        res.json(activities);
    } catch (err) {
        console.error("Error fetching workspace activity:", err);
        res.status(500).json({ message: 'Error fetching workspace activity' });
    }
});

// Invite a user to workspace
app.post('/api/workspaces/:id/invite', ensureAuthenticated, async (req, res) => {
    try {
        const { email, role } = req.body;

        // Mock response with the newly invited user
        const newCollaborator = {
            userId: "mock-user-id",
            email: email,
            displayName: email.split('@')[0], // Use part before @ as mock name
            role: role,
            joinedAt: new Date()
        };

        res.status(201).json(newCollaborator);
    } catch (err) {
        console.error("Error inviting user:", err);
        res.status(500).json({ message: 'Error inviting user to workspace' });
    }
});

// Delete a collaborator from workspace
app.delete('/api/workspaces/:id/collaborators/:userId', ensureAuthenticated, async (req, res) => {
    try {
        // Add success details for better frontend handling
        res.status(200).json({
            message: "Collaborator removed successfully",
            userId: req.params.userId,
            workspaceId: req.params.id
        });
    } catch (err) {
        console.error("Error removing collaborator:", err);
        res.status(500).json({ message: 'Error removing collaborator' });
    }
});

// Update a collaborator's role
app.patch('/api/workspaces/:id/collaborators/:userId', ensureAuthenticated, async (req, res) => {
    try {
        const { role } = req.body;

        // Validate role
        if (!role || !['admin', 'editor', 'viewer'].includes(role)) {
            return res.status(400).json({ message: 'Invalid role provided' });
        }

        // Mock updated collaborator data with more complete information
        const updatedCollaborator = {
            userId: req.params.userId,
            workspaceId: req.params.id,
            role: role,
            updatedAt: new Date()
        };

        res.json(updatedCollaborator);
    } catch (err) {
        console.error("Error updating collaborator role:", err);
        res.status(500).json({ message: 'Error updating collaborator role' });
    }
});

// --- COLLECTIONS ROUTES ---

// Get all of the user's collections
app.get('/api/collections', ensureAuthenticated, async (req, res) => {
    try {
        // For now, return mock data since the Collection model isn't defined yet
        const userId = req.user.id;

        // Mock collections data
        const collections = [
            {
                _id: "coll1",
                name: "Personal API Collection",
                description: "My personal collection of frequently used APIs",
                isPublic: false,
                owner: userId,
                requestCount: 5,
                collaborators: [],
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                _id: "coll2",
                name: "Project X APIs",
                description: "APIs used in the Project X development",
                isPublic: false,
                owner: userId,
                requestCount: 12,
                collaborators: [
                    {
                        email: "collaborator@example.com",
                        role: "viewer"
                    }
                ],
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                _id: "coll3",
                name: "Public Demo Collection",
                description: "Public collection of demo APIs",
                isPublic: true,
                owner: userId,
                requestCount: 8,
                collaborators: [],
                createdAt: new Date(),
                updatedAt: new Date()
            }
        ];

        res.json(collections);
    } catch (err) {
        console.error("Error fetching collections:", err);
        res.status(500).json({ message: 'Error fetching collections' });
    }
});

// Get collections shared with the user
app.get('/api/collections/shared', ensureAuthenticated, async (req, res) => {
    try {
        const userId = req.user.id;

        // Mock shared collections data
        const sharedCollections = [
            {
                _id: "shared1",
                name: "Team Project APIs",
                description: "APIs used by the development team",
                isPublic: false,
                owner: "other-user-id",
                requestCount: 15,
                myRole: "viewer",
                collaborators: [
                    {
                        email: req.user.email,
                        role: "viewer"
                    },
                    {
                        email: "team-lead@example.com",
                        role: "editor"
                    }
                ],
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                _id: "shared2",
                name: "Documentation APIs",
                description: "APIs used for documentation generation",
                isPublic: false,
                owner: "another-user-id",
                requestCount: 7,
                myRole: "editor",
                collaborators: [
                    {
                        email: req.user.email,
                        role: "editor"
                    }
                ],
                createdAt: new Date(),
                updatedAt: new Date()
            }
        ];

        res.json(sharedCollections);
    } catch (err) {
        console.error("Error fetching shared collections:", err);
        res.status(500).json({ message: 'Error fetching shared collections' });
    }
});

// Get a specific collection by ID
app.get('/api/collections/:id', ensureAuthenticated, async (req, res) => {
    try {
        const collectionId = req.params.id;
        const userId = req.user.id;

        console.log(`Fetching collection with ID: ${collectionId}`);

        // First check for dynamically created collections in our store
        if (collectionsStore) {
            // Look through all workspace collections for this ID
            for (const workspaceId in collectionsStore) {
                const matchingCollection = collectionsStore[workspaceId].find(
                    coll => coll._id === collectionId
                );

                if (matchingCollection) {
                    console.log(`Found collection in collectionsStore for workspace ${workspaceId}`);
                    // Add some mock requests to the collection
                    const collectionWithRequests = {
                        ...matchingCollection,
                        requests: [
                            { _id: `req-${Date.now()}-1`, name: "Get Data", method: "GET", url: "https://api.example.com/data" },
                            { _id: `req-${Date.now()}-2`, name: "Create Item", method: "POST", url: "https://api.example.com/items" }
                        ]
                    };
                    return res.json(collectionWithRequests);
                }
            }
        }

        // If we didn't find the collection in the store, check for static mock collections
        let collection;

        switch (collectionId) {
            case "coll1":
                collection = {
                    _id: "coll1",
                    name: "Personal API Collection",
                    description: "My personal collection of frequently used APIs",
                    isPublic: false,
                    owner: userId,
                    requests: [
                        { _id: "req1", name: "Get Users", method: "GET", url: "https://api.example.com/users" },
                        { _id: "req2", name: "Create User", method: "POST", url: "https://api.example.com/users" },
                        { _id: "req3", name: "Get User by ID", method: "GET", url: "https://api.example.com/users/123" },
                        { _id: "req4", name: "Update User", method: "PUT", url: "https://api.example.com/users/123" },
                        { _id: "req5", name: "Delete User", method: "DELETE", url: "https://api.example.com/users/123" }
                    ],
                    collaborators: [],
                    createdAt: new Date(),
                    updatedAt: new Date()
                };
                break;
            case "coll2":
                collection = {
                    _id: "coll2",
                    name: "Project X APIs",
                    description: "APIs used in the Project X development",
                    isPublic: false,
                    owner: userId,
                    requests: [
                        { _id: "req6", name: "Authentication", method: "POST", url: "https://api.example.com/auth" },
                        { _id: "req7", name: "Get Profile", method: "GET", url: "https://api.example.com/profile" }
                    ],
                    collaborators: [
                        {
                            email: "collaborator@example.com",
                            role: "viewer"
                        }
                    ],
                    createdAt: new Date(),
                    updatedAt: new Date()
                };
                break;
            case "coll3":
                collection = {
                    _id: "coll3",
                    name: "Public Demo Collection",
                    description: "Public collection of demo APIs",
                    isPublic: true,
                    owner: userId,
                    requests: [
                        { _id: "req8", name: "Weather API", method: "GET", url: "https://api.weather.com/current" },
                        { _id: "req9", name: "Currency Exchange", method: "GET", url: "https://api.exchange.com/rates" }
                    ],
                    collaborators: [],
                    createdAt: new Date(),
                    updatedAt: new Date()
                };
                break;
            case "shared1":
                collection = {
                    _id: "shared1",
                    name: "Team Project APIs",
                    description: "APIs used by the development team",
                    isPublic: false,
                    owner: "other-user-id",
                    myRole: "viewer",
                    requests: [
                        { _id: "req10", name: "Team Auth", method: "POST", url: "https://api.team.com/auth" },
                        { _id: "req11", name: "Get Team Members", method: "GET", url: "https://api.team.com/members" }
                    ],
                    collaborators: [
                        {
                            email: req.user.email,
                            role: "viewer"
                        },
                        {
                            email: "team-lead@example.com",
                            role: "editor"
                        }
                    ],
                    createdAt: new Date(),
                    updatedAt: new Date()
                };
                break;
            default:
                // Try to handle dynamically generated collection IDs (like coll100)
                if (collectionId.startsWith('coll')) {
                    collection = {
                        _id: collectionId,
                        name: `Collection ${collectionId.replace('coll', '')}`,
                        description: "Dynamically created collection",
                        isPublic: false,
                        owner: userId,
                        requests: [
                            { _id: `req-${Date.now()}-1`, name: "Get Data", method: "GET", url: "https://api.example.com/data" },
                            { _id: `req-${Date.now()}-2`, name: "Create Item", method: "POST", url: "https://api.example.com/items" }
                        ],
                        collaborators: [],
                        createdAt: new Date(),
                        updatedAt: new Date()
                    };
                    break;
                }
                return res.status(404).json({ message: 'Collection not found' });
        }

        res.json(collection);
    } catch (err) {
        console.error("Error fetching collection:", err);
        res.status(500).json({ message: 'Error fetching collection' });
    }
});

// Create a new collection - Store in MongoDB
app.post('/api/collections', ensureAuthenticated, async (req, res) => {
    try {
        const { name, description, workspaceId } = req.body;
        const userId = req.user.id;

        // Validate required fields
        if (!name) {
            return res.status(400).json({ message: 'Collection name is required' });
        }

        // Create the new collection object
        const newCollection = {
            name,
            description: description || "",
            workspaceId: workspaceId || "ws1", // Default to personal workspace if not specified
            isPublic: false,
            owner: userId,
            requestsCount: 0,
            collaborators: [],
            createdAt: new Date(),
            updatedAt: new Date()
        };

        // Store the collection in MongoDB
        const result = await db.collection('collections').insertOne(newCollection);

        // Add the MongoDB _id to the collection
        newCollection._id = result.insertedId;

        // For backward compatibility, also store in memory
        if (!collectionsStore[newCollection.workspaceId]) {
            collectionsStore[newCollection.workspaceId] = [];
        }

        // Convert MongoDB ObjectId to string for memory store
        const memoryCollection = {
            ...newCollection,
            _id: result.insertedId.toString()
        };

        collectionsStore[newCollection.workspaceId].push(memoryCollection);
        console.log(`Added collection ${newCollection._id} to workspace ${newCollection.workspaceId}`);
        console.log(`Workspace now has ${collectionsStore[newCollection.workspaceId].length} collections`);

        res.status(201).json({
            ...newCollection,
            _id: result.insertedId.toString() // Convert ObjectId to string for the client
        });
    } catch (err) {
        console.error("Error creating collection:", err);
        res.status(500).json({ message: 'Error creating collection' });
    }
});

// Update a collection
app.put('/api/collections/:id', ensureAuthenticated, async (req, res) => {
    try {
        const collectionId = req.params.id;
        const { name, description, isPublic } = req.body;

        // Mock updating the collection
        const updatedCollection = {
            _id: collectionId,
            name: name || "Updated Collection Name",
            description: description || "Updated collection description",
            isPublic: isPublic !== undefined ? isPublic : false,
            owner: req.user.id,
            requestCount: 0,
            collaborators: [],
            createdAt: new Date(Date.now() - 86400000), // 1 day ago
            updatedAt: new Date()
        };

        res.json(updatedCollection);
    } catch (err) {
        console.error("Error updating collection:", err);
        res.status(500).json({ message: 'Error updating collection' });
    }
});

// Delete a collection
app.delete('/api/collections/:id', ensureAuthenticated, async (req, res) => {
    try {
        // Just return success response
        res.json({ message: 'Collection deleted successfully' });
    } catch (err) {
        console.error("Error deleting collection:", err);
        res.status(500).json({ message: 'Error deleting collection' });
    }
});

// Share a collection with another user
app.post('/api/collections/:id/share', ensureAuthenticated, async (req, res) => {
    try {
        const collectionId = req.params.id;
        const { email, role } = req.body;

        if (!email) {
            return res.status(400).json({ message: 'Email is required' });
        }

        if (!['viewer', 'editor'].includes(role)) {
            return res.status(400).json({ message: 'Invalid role. Must be either "viewer" or "editor"' });
        }

        // Mock successful sharing
        res.json({
            message: 'Collection shared successfully',
            collaboration: {
                collectionId,
                email,
                role,
                addedAt: new Date()
            }
        });
    } catch (err) {
        console.error("Error sharing collection:", err);
        res.status(500).json({ message: 'Error sharing collection' });
    }
});

// Fork a collection
app.post('/api/collections/:id/fork', ensureAuthenticated, async (req, res) => {
    try {
        const sourceCollectionId = req.params.id;
        const userId = req.user.id;

        // Mock creating a forked collection
        const forkedCollection = {
            _id: "fork" + Date.now().toString(),
            name: "Fork of Collection",
            description: "Forked collection from another user",
            isPublic: false,
            owner: userId,
            forkedFrom: sourceCollectionId,
            requestCount: 3,
            collaborators: [],
            createdAt: new Date(),
            updatedAt: new Date()
        };

        res.status(201).json(forkedCollection);
    } catch (err) {
        console.error("Error forking collection:", err);
        res.status(500).json({ message: 'Error forking collection' });
    }
});

// Create a merge request
app.post('/api/collections/:id/merge-request', ensureAuthenticated, async (req, res) => {
    try {
        const sourceCollectionId = req.params.id;
        const { targetCollectionId } = req.body;

        if (!targetCollectionId) {
            return res.status(400).json({ message: 'Target collection ID is required' });
        }

        // Mock creating a merge request
        const mergeRequest = {
            _id: "merge" + Date.now().toString(),
            sourceCollectionId,
            targetCollectionId,
            status: "pending",
            changes: {
                added: 2,
                modified: 1,
                deleted: 0
            },
            createdBy: req.user.id,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        res.status(201).json(mergeRequest);
    } catch (err) {
        console.error("Error creating merge request:", err);
        res.status(500).json({ message: 'Error creating merge request' });
    }
});

// Approve a merge request
app.post('/api/merge-requests/:id/approve', ensureAuthenticated, async (req, res) => {
    try {
        const mergeRequestId = req.params.id;

        // Mock approving a merge request
        const approvedMergeRequest = {
            _id: mergeRequestId,
            status: "approved",
            actionBy: {
                userId: req.user.id,
                displayName: req.user.name || "User",
                email: req.user.email
            },
            updatedAt: new Date()
        };

        res.json(approvedMergeRequest);
    } catch (err) {
        console.error("Error approving merge request:", err);
        res.status(500).json({ message: 'Error approving merge request' });
    }
});

// Reject a merge request
app.post('/api/merge-requests/:id/reject', ensureAuthenticated, async (req, res) => {
    try {
        const mergeRequestId = req.params.id;

        // Mock rejecting a merge request
        const rejectedMergeRequest = {
            _id: mergeRequestId,
            status: "rejected",
            actionBy: {
                userId: req.user.id,
                displayName: req.user.name || "User",
                email: req.user.email
            },
            updatedAt: new Date()
        };

        res.json(rejectedMergeRequest);
    } catch (err) {
        console.error("Error rejecting merge request:", err);
        res.status(500).json({ message: 'Error rejecting merge request' });
    }
});

// --- WORKSPACE ROUTES ---

// Get all workspaces
app.get('/api/workspaces', ensureAuthenticated, async (req, res) => {
    try {
        const userId = req.user.id;

        // Convert workspacesStore to arrays of personal and team workspaces
        const personalWorkspaces = [];
        const teamWorkspaces = [];

        // Get workspaces from our dynamic store
        for (const wsId in workspacesStore) {
            const workspace = {
                ...workspacesStore[wsId],
                _id: wsId,
                owner: userId,
                createdAt: new Date(),
                collaboratorsCount: 1,
                collectionsCount: collectionsStore[wsId] ? collectionsStore[wsId].length : 0
            };

            if (workspace.isPersonal) {
                personalWorkspaces.push(workspace);
            } else {
                teamWorkspaces.push(workspace);
            }
        }

        // Add default workspaces if none exist
        if (personalWorkspaces.length === 0 && teamWorkspaces.length === 0) {
            personalWorkspaces.push({
                _id: "ws1",
                name: "API Testing",
                description: "Workspace for API testing and documentation",
                isPersonal: true,
                isPublic: false,
                owner: "temp-user-id",
                createdAt: new Date(),
                collaboratorsCount: 1,
                collectionsCount: 3
            });
            personalWorkspaces.push({
                _id: "ws2",
                name: "Frontend Development",
                description: "Frontend development workspace",
                isPersonal: true,
                isPublic: false,
                owner: "temp-user-id",
                createdAt: new Date(),
                collaboratorsCount: 1,
                collectionsCount: 2
            });
            teamWorkspaces.push({
                _id: "ws3",
                name: "Team Project X",
                description: "Collaborative workspace for Project X",
                isPersonal: false,
                isPublic: false,
                owner: "temp-user-id",
                createdAt: new Date(),
                collaboratorsCount: 5,
                collectionsCount: 8
            });
        }

        res.json({
            personal: personalWorkspaces,
            team: teamWorkspaces
        });
    } catch (err) {
        console.error("Error fetching workspaces:", err);
        res.status(500).json({ message: 'Error fetching workspaces' });
    }
});

// Get workspace by ID
app.get('/api/workspaces/:id', ensureAuthenticated, async (req, res) => {
    try {
        const workspaceId = req.params.id;
        const userId = req.user.id;

        // Check if this is a workspace we've seen before
        let workspace;

        // Use the stored workspace data if it exists
        if (workspacesStore[workspaceId]) {
            // Use the stored name and description
            const storedWorkspace = workspacesStore[workspaceId];

            workspace = {
                _id: workspaceId,
                name: storedWorkspace.name,
                description: storedWorkspace.description,
                isPersonal: storedWorkspace.isPersonal,
                isPublic: storedWorkspace.isPublic,
                owner: userId,
                userRole: "admin", // Assuming the requester is the admin/owner
                memberCount: workspaceId === "ws1" ? 1 : 5,
                collectionCount: workspaceId === "ws1" ? 2 : 4,
                collaborators: [
                    {
                        userId: userId,
                        displayName: req.user.name || "User",
                        email: req.user.email,
                        role: "admin",
                        joinedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 days ago
                    }
                ],
                createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
                updatedAt: new Date()
            };
        } else {
            // This is a new workspace - provide default values
            return res.status(404).json({ message: 'Workspace not found' });
        }

        res.json(workspace);
    } catch (err) {
        console.error("Error fetching workspace:", err);
        res.status(500).json({ message: 'Error fetching workspace' });
    }
});

// Get workspace collections
app.get('/api/workspaces/:id/collections', ensureAuthenticated, async (req, res) => {
    try {
        const workspaceId = req.params.id;
        const userId = req.user.id;

        // Mock collections data based on workspace ID
        let collections = [];

        switch (workspaceId) {
            case "ws1":
                collections = [
                    {
                        _id: "coll1",
                        name: "Personal API Collection",
                        description: "My personal collection of frequently used APIs",
                        workspaceId: "ws1",
                        owner: userId,
                        isPublic: false,
                        requestsCount: 5,
                        createdAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000), // 25 days ago
                        updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)  // 1 day ago
                    },
                    {
                        _id: "coll3",
                        name: "Public Demo Collection",
                        description: "Public collection of demo APIs",
                        workspaceId: "ws1",
                        owner: userId,
                        isPublic: true,
                        requestsCount: 8,
                        createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), // 20 days ago
                        updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)  // 2 days ago
                    }
                ];
                break;
            case "ws2":
                collections = [
                    {
                        _id: "coll4",
                        name: "API Testing Collection",
                        description: "APIs for testing our services",
                        workspaceId: "ws2",
                        owner: "other-user-id",
                        isPublic: false,
                        requestsCount: 15,
                        createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 14 days ago
                        updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)  // 1 day ago
                    },
                    {
                        _id: "coll5",
                        name: "Authentication APIs",
                        description: "All authentication-related API endpoints",
                        workspaceId: "ws2",
                        owner: "other-user-id",
                        isPublic: false,
                        requestsCount: 7,
                        createdAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000), // 12 days ago
                        updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)  // 3 days ago
                    },
                    {
                        _id: "coll6",
                        name: "User Management APIs",
                        description: "User creation, updates, and management endpoints",
                        workspaceId: "ws2",
                        owner: "member3",
                        isPublic: false,
                        requestsCount: 10,
                        createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
                        updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)  // 2 days ago
                    }
                ];
                break;
            case "ws3":
                collections = [
                    {
                        _id: "coll7",
                        name: "Public API Documentation",
                        description: "Public endpoints documentation",
                        workspaceId: "ws3",
                        owner: "another-user-id",
                        isPublic: true,
                        requestsCount: 12,
                        createdAt: new Date(Date.now() - 58 * 24 * 60 * 60 * 1000), // 58 days ago
                        updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)  // 5 days ago
                    },
                    {
                        _id: "coll8",
                        name: "Integration Examples",
                        description: "Examples of integration with our APIs",
                        workspaceId: "ws3",
                        owner: "another-user-id",
                        isPublic: true,
                        requestsCount: 8,
                        createdAt: new Date(Date.now() - 50 * 24 * 60 * 60 * 1000), // 50 days ago
                        updatedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)  // 10 days ago
                    }
                ];
                break;
            default:
                collections = [];
        }

        res.json(collections);
    } catch (err) {
        console.error("Error fetching workspace collections:", err);
        res.status(500).json({ message: 'Error fetching workspace collections' });
    }
});

// Get workspace merge requests
app.get('/api/workspaces/:id/merge-requests', ensureAuthenticated, async (req, res) => {
    try {
        const workspaceId = req.params.id;

        // Mock merge requests data based on workspace ID
        let mergeRequests = [];

        switch (workspaceId) {
            case "ws1":
                mergeRequests = []; // No merge requests in personal workspace
                break;
            case "ws2":
                mergeRequests = [
                    {
                        _id: "mr1",
                        title: "Update Authentication APIs",
                        description: "Adding new OAuth2 endpoints",
                        sourceCollection: {
                            _id: "coll9",
                            name: "OAuth2 APIs"
                        },
                        targetCollection: {
                            _id: "coll5",
                            name: "Authentication APIs"
                        },
                        status: "pending",
                        createdBy: {
                            userId: "member1",
                            displayName: "Team Member 1",
                            email: "member1@example.com"
                        },
                        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
                        updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)  // 1 day ago
                    },
                    {
                        _id: "mr2",
                        title: "New User API Endpoints",
                        description: "Adding subscription management endpoints",
                        sourceCollection: {
                            _id: "coll10",
                            name: "Subscription APIs"
                        },
                        targetCollection: {
                            _id: "coll6",
                            name: "User Management APIs"
                        },
                        status: "approved",
                        createdBy: {
                            userId: "member3",
                            displayName: "Team Member 3",
                            email: "member3@example.com"
                        },
                        actionBy: {
                            userId: "other-user-id",
                            displayName: "Team Lead",
                            email: "team.lead@example.com"
                        },
                        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
                        updatedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000)  // 4 days ago
                    },
                    {
                        _id: "mr3",
                        title: "Deprecated API Removal",
                        description: "Removing old v1 endpoints",
                        sourceCollection: {
                            _id: "coll11",
                            name: "API Cleanup"
                        },
                        targetCollection: {
                            _id: "coll4",
                            name: "API Testing Collection"
                        },
                        status: "rejected",
                        createdBy: {
                            userId: "member2",
                            displayName: "Team Member 2",
                            email: "member2@example.com"
                        },
                        actionBy: {
                            userId: "other-user-id",
                            displayName: "Team Lead",
                            email: "team.lead@example.com"
                        },
                        createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000), // 8 days ago
                        updatedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)  // 7 days ago
                    }
                ];
                break;
            case "ws3":
                mergeRequests = [
                    {
                        _id: "mr4",
                        title: "Add Payment API Documentation",
                        description: "New payment gateway documentation",
                        sourceCollection: {
                            _id: "coll12",
                            name: "Payment APIs"
                        },
                        targetCollection: {
                            _id: "coll7",
                            name: "Public API Documentation"
                        },
                        status: "pending",
                        createdBy: {
                            userId: "contributor1",
                            displayName: "Contributor 1",
                            email: "contributor1@example.com"
                        },
                        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
                        updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)  // 2 days ago
                    }
                ];
                break;
            default:
                mergeRequests = [];
        }

        res.json(mergeRequests);
    } catch (err) {
        console.error("Error fetching workspace merge requests:", err);
        res.status(500).json({ message: 'Error fetching workspace merge requests' });
    }
});

// Get workspace activity
app.get('/api/workspaces/:id/activity', ensureAuthenticated, async (req, res) => {
    try {
        const workspaceId = req.params.id;

        // Mock activity data based on workspace ID
        let activities = [];

        switch (workspaceId) {
            case "ws1":
                activities = [
                    {
                        _id: "act1",
                        type: "collection_created",
                        message: "Created collection 'Personal API Collection'",
                        user: {
                            userId: req.user.id,
                            displayName: req.user.name || "User",
                            email: req.user.email
                        },
                        timestamp: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000) // 25 days ago
                    },
                    {
                        _id: "act2",
                        type: "collection_created",
                        message: "Created collection 'Public Demo Collection'",
                        user: {
                            userId: req.user.id,
                            displayName: req.user.name || "User",
                            email: req.user.email
                        },
                        timestamp: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000) // 20 days ago
                    },
                    {
                        _id: "act3",
                        type: "request_added",
                        message: "Added 3 requests to 'Personal API Collection'",
                        user: {
                            userId: req.user.id,
                            displayName: req.user.name || "User",
                            email: req.user.email
                        },
                        timestamp: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000) // 18 days ago
                    },
                    {
                        _id: "act4",
                        type: "request_sent",
                        message: "Executed GET request to 'api.example.com/users'",
                        user: {
                            userId: req.user.id,
                            displayName: req.user.name || "User",
                            email: req.user.email
                        },
                        timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) // 1 day ago
                    }
                ];
                break;
            case "ws2":
                activities = [
                    {
                        _id: "act5",
                        type: "collection_created",
                        message: "Created collection 'API Testing Collection'",
                        user: {
                            userId: "other-user-id",
                            displayName: "Team Lead",
                            email: "team.lead@example.com"
                        },
                        timestamp: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) // 14 days ago
                    },
                    {
                        _id: "act6",
                        type: "user_added",
                        message: `Added ${req.user.name || "User"} to the workspace`,
                        user: {
                            userId: "other-user-id",
                            displayName: "Team Lead",
                            email: "team.lead@example.com"
                        },
                        timestamp: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) // 10 days ago
                    },
                    {
                        _id: "act7",
                        type: "merge_requested",
                        message: "Created merge request 'Update Authentication APIs'",
                        user: {
                            userId: "member1",
                            displayName: "Team Member 1",
                            email: "member1@example.com"
                        },
                        timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) // 1 day ago
                    }
                ];
                break;
            case "ws3":
                activities = [
                    {
                        _id: "act8",
                        type: "collection_created",
                        message: "Created collection 'Public API Documentation'",
                        user: {
                            userId: "another-user-id",
                            displayName: "Documentation Manager",
                            email: "docs.manager@example.com"
                        },
                        timestamp: new Date(Date.now() - 58 * 24 * 60 * 60 * 1000) // 58 days ago
                    },
                    {
                        _id: "act9",
                        type: "user_added",
                        message: `Added ${req.user.name || "User"} to the workspace`,
                        user: {
                            userId: "another-user-id",
                            displayName: "Documentation Manager",
                            email: "docs.manager@example.com"
                        },
                        timestamp: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000) // 20 days ago
                    }
                ];
                break;
            default:
                activities = [];
        }

        res.json(activities);
    } catch (err) {
        console.error("Error fetching workspace activity:", err);
        res.status(500).json({ message: 'Error fetching workspace activity' });
    }
});

// Invite user to workspace
app.post('/api/workspaces/:id/invite', ensureAuthenticated, async (req, res) => {
    try {
        const workspaceId = req.params.id;
        const { email, role } = req.body;

        // Validate inputs
        if (!email) {
            return res.status(400).json({ message: 'Email is required' });
        }

        if (!['admin', 'editor', 'viewer'].includes(role)) {
            return res.status(400).json({ message: 'Invalid role. Must be admin, editor, or viewer' });
        }

        // Mock response for adding a collaborator
        const newCollaborator = {
            userId: "new-user-" + Date.now(),
            displayName: email.split('@')[0], // Just use the first part of the email as name
            email,
            role,
            joinedAt: new Date()
        };

        res.status(201).json(newCollaborator);
    } catch (err) {
        console.error("Error inviting user to workspace:", err);
        res.status(500).json({ message: 'Error inviting user to workspace' });
    }
});

// Update collaborator role
app.patch('/api/workspaces/:id/collaborators/:collaboratorId', ensureAuthenticated, async (req, res) => {
    try {
        const { role } = req.body;

        // Validate role
        if (!['admin', 'editor', 'viewer'].includes(role)) {
            return res.status(400).json({ message: 'Invalid role. Must be admin, editor, or viewer' });
        }

        // Return the updated collaborator data
        const updatedCollaborator = {
            userId: req.params.collaboratorId,
            displayName: "Updated User",
            email: "updated.user@example.com",
            role,
            joinedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
            updatedAt: new Date()
        };

        res.json(updatedCollaborator);
    } catch (err) {
        console.error("Error updating collaborator:", err);
        res.status(500).json({ message: 'Error updating collaborator' });
    }
});

// Remove collaborator
app.delete('/api/workspaces/:id/collaborators/:collaboratorId', ensureAuthenticated, async (req, res) => {
    try {
        // Simply return success response
        res.json({ message: 'Collaborator removed successfully' });
    } catch (err) {
        console.error("Error removing collaborator:", err);
        res.status(500).json({ message: 'Error removing collaborator' });
    }
});

// Create workspace
app.post('/api/workspaces', ensureAuthenticated, async (req, res) => {
    try {
        const { name, description, isPersonal, isPublic } = req.body;
        const userId = req.user.id;

        // Validate input
        if (!name) {
            return res.status(400).json({ message: 'Workspace name is required' });
        }

        // Create a new workspace document for MongoDB
        const newWorkspace = {
            name: name,
            description: description || "",
            isPersonal: isPersonal || false,
            isPublic: isPublic || false,
            owner: userId,
            userRole: "admin",
            collaborators: [
                {
                    userId: userId,
                    displayName: req.user.name || "User",
                    email: req.user.email,
                    role: "admin",
                    joinedAt: new Date()
                }
            ],
            createdAt: new Date(),
            updatedAt: new Date()
        };

        // Store the workspace in MongoDB
        const result = await db.collection('workspaces').insertOne(newWorkspace);

        // Add the _id to the workspace object
        newWorkspace._id = result.insertedId;

        // For backward compatibility, also store in memory
        const workspaceId = result.insertedId.toString();
        workspacesStore[workspaceId] = {
            name: name,
            description: description || "",
            isPersonal: isPersonal || false,
            isPublic: isPublic || false
        };

        console.log(`Created new workspace "${name}" with ID: ${workspaceId}`);

        // Return the created workspace
        res.status(201).json({
            ...newWorkspace,
            _id: workspaceId,
            memberCount: 1,
            collectionCount: 0
        });
    } catch (err) {
        console.error("Error creating workspace:", err);
        res.status(500).json({ message: 'Error creating workspace' });
    }
});

// Update workspace
app.put('/api/workspaces/:id', ensureAuthenticated, async (req, res) => {
    try {
        let workspaceId = req.params.id;
        const { name, description, isPublic } = req.body;

        // Log to help with debugging
        console.log(`Updating workspace ${workspaceId} with:`, { name, description, isPublic });

        // Special handling for "my-workspace" - map to personal workspace
        if (workspaceId === 'my-workspace') {
            workspaceId = "ws1"; // Map to the actual personal workspace ID
            console.log(`Mapped "my-workspace" to personal workspace ID: ${workspaceId}`);
        }

        // Validate input
        if (!name) {
            return res.status(400).json({ message: 'Workspace name is required' });
        }

        // Check if the workspace exists in our store
        if (!workspacesStore[workspaceId]) {
            return res.status(404).json({ message: 'Workspace not found' });
        }

        // Make a copy of the existing workspace data before modifying it
        const existingWorkspace = { ...workspacesStore[workspaceId] };

        // Special handling for personal workspace (ws1)
        if (workspaceId === "ws1" || existingWorkspace.isPersonal) {
            workspacesStore[workspaceId] = {
                _id: workspaceId,
                name: name,
                description: description || existingWorkspace.description,
                isPersonal: true, // Always keep personal status for personal workspace
                isPublic: false   // Personal workspaces cannot be public
            };

            console.log(`Personal workspace updated:`, workspacesStore[workspaceId]);
        } else {
            // For non-personal workspaces
            workspacesStore[workspaceId] = {
                _id: workspaceId,
                name: name,
                description: description || existingWorkspace.description,
                isPersonal: existingWorkspace.isPersonal,
                isPublic: isPublic !== undefined ? isPublic : existingWorkspace.isPublic
            };

            console.log(`Team workspace updated:`, workspacesStore[workspaceId]);
        }

        // Send the updated workspace back
        const updatedWorkspace = {
            _id: workspaceId === "ws1" ? "my-workspace" : workspaceId, // Send back my-workspace ID if it's the personal workspace
            name: workspacesStore[workspaceId].name,
            description: workspacesStore[workspaceId].description,
            isPersonal: workspacesStore[workspaceId].isPersonal,
            isPublic: workspacesStore[workspaceId].isPublic,
            owner: req.user.id,
            userRole: "admin",
            updatedAt: new Date()
        };

        res.json(updatedWorkspace);
    } catch (err) {
        console.error("Error updating workspace:", err);
        res.status(500).json({ message: 'Error updating workspace' });
    }
});

// Delete workspace
app.delete('/api/workspaces/:id', ensureAuthenticated, async (req, res) => {
    try {
        const workspaceId = req.params.id;

        // Don't allow deleting personal workspace
        if (workspaceId === "ws1") {
            return res.status(400).json({ message: 'Cannot delete personal workspace' });
        }

        // Return success response
        res.json({ message: 'Workspace deleted successfully' });
    } catch (err) {
        console.error("Error deleting workspace:", err);
        res.status(500).json({ message: 'Error deleting workspace' });
    }
});

// Merge request endpoints
app.post('/api/merge-requests/:id/approve', ensureAuthenticated, async (req, res) => {
    try {
        const mergeRequestId = req.params.id;

        // Return success response
        res.json({
            message: 'Merge request approved successfully',
            mergeRequest: {
                _id: mergeRequestId,
                status: 'approved',
                actionBy: {
                    userId: req.user.id,
                    displayName: req.user.name || "User",
                    email: req.user.email
                },
                updatedAt: new Date()
            }
        });
    } catch (err) {
        console.error("Error approving merge request:", err);
        res.status(500).json({ message: 'Error approving merge request' });
    }
});

app.post('/api/merge-requests/:id/reject', ensureAuthenticated, async (req, res) => {
    try {
        const mergeRequestId = req.params.id;

        // Return success response
        res.json({
            message: 'Merge request rejected successfully',
            mergeRequest: {
                _id: mergeRequestId,
                status: 'rejected',
                actionBy: {
                    userId: req.user.id,
                    displayName: req.user.name || "User",
                    email: req.user.email
                },
                updatedAt: new Date()
            }
        });
    } catch (err) {
        console.error("Error rejecting merge request:", err);
        res.status(500).json({ message: 'Error rejecting merge request' });
    }
});

app.get('/api/workspaces', ensureAuthenticated, async (req, res) => {
    try {
        // Mock workspaces data based on user auth
        // In a real implementation, this would query a database
        const userWorkspaces = {
            personal: [
                {
                    _id: "ws1",
                    name: "API Testing",
                    description: "Workspace for API testing and documentation",
                    isPersonal: true,
                    isPublic: false,
                    owner: "temp-user-id",
                    createdAt: new Date(),
                    collaboratorsCount: 1,
                    collectionsCount: 3
                },
                {
                    _id: "ws2",
                    name: "Frontend Development",
                    description: "Frontend development workspace",
                    isPersonal: true,
                    isPublic: false,
                    owner: "temp-user-id",
                    createdAt: new Date(),
                    collaboratorsCount: 1,
                    collectionsCount: 2
                }
            ],
            team: [
                {
                    _id: "ws3",
                    name: "Team Project X",
                    description: "Collaborative workspace for Project X",
                    isPersonal: false,
                    isPublic: false,
                    owner: "temp-user-id",
                    createdAt: new Date(),
                    collaboratorsCount: 5,
                    collectionsCount: 8
                }
            ]
        };

        res.json(userWorkspaces);
    } catch (err) {
        console.error("Error fetching workspaces:", err);
        res.status(500).json({ message: 'Error fetching workspaces' });
    }
});

// Get workspaces shared with the user
app.get('/api/workspaces/shared', ensureAuthenticated, async (req, res) => {
    try {
        // Mock shared workspaces data
        const sharedWorkspaces = {
            personal: [
                {
                    _id: "shared_ws1",
                    name: "Alex's Personal Workspace",
                    description: "Personal workspace shared by Alex",
                    isPersonal: true,
                    isPublic: false,
                    owner: "alex-user-id",
                    userRole: "Viewer",
                    createdAt: new Date(),
                    collaboratorsCount: 2,
                    collectionsCount: 3
                }
            ],
            team: [
                {
                    _id: "shared_ws2",
                    name: "Marketing Team",
                    description: "Workspace for our marketing initiatives",
                    isPersonal: false,
                    isPublic: false,
                    owner: "sarah-user-id",
                    userRole: "Editor",
                    createdAt: new Date(),
                    collaboratorsCount: 8,
                    collectionsCount: 12
                },
                {
                    _id: "shared_ws3",
                    name: "Product Development",
                    description: "Workspace for product development and testing",
                    isPersonal: false,
                    isPublic: false,
                    owner: "mike-user-id",
                    userRole: "Contributor",
                    createdAt: new Date(),
                    collaboratorsCount: 6,
                    collectionsCount: 15
                }
            ]
        };

        res.json(sharedWorkspaces);
    } catch (err) {
        console.error("Error fetching shared workspaces:", err);
        res.status(500).json({ message: 'Error fetching shared workspaces' });
    }
});

// WebSocket connection and event handling setup
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Track user rooms (workspaces/collections they are in)
    const userRooms = new Set();
    let authenticatedUser = null;

    // Authenticate the socket connection with the session
    socket.on('authenticate', async (userData, callback) => {
        try {
            // Store user data with the socket
            authenticatedUser = {
                id: userData.userId || socket.id,
                name: userData.name || 'Anonymous',
                email: userData.email || null,
                avatar: userData.avatar || null,
                // Add important fields for consistent overlay display
                displayName: userData.displayName || userData.name || 'Anonymous',
                profilePicture: userData.profilePicture || userData.avatar || null,
                userStatus: userData.userStatus || 'online'
            };

            // Explicitly set this on the socket object so other parts can access it
            socket.authenticatedUser = authenticatedUser;

            console.log(`User authenticated: ${authenticatedUser.name} (${socket.id})`);

            // Send successful authentication response
            if (callback) {
                callback({
                    success: true,
                    message: 'Authentication successful',
                    userId: authenticatedUser.id,
                    displayName: authenticatedUser.displayName
                });
            }
        } catch (err) {
            console.error('Authentication error:', err);
            if (callback) {
                callback({ success: false, message: 'Authentication failed' });
            }
        }
    });

    // Helper function to join a room and notify others
    const joinRoom = (roomName) => {
        if (!authenticatedUser) {
            console.warn(`Unauthenticated user ${socket.id} attempted to join room ${roomName}`);
            return;
        }

        socket.join(roomName);
        userRooms.add(roomName);

        // Notify others in the room that someone joined with consistent data structure
        socket.to(roomName).emit('userJoined', {
            userId: socket.id,
            user: authenticatedUser,
            timestamp: new Date()
        });

        // Get and send current active users in this room with consistent data structure
        const roomSockets = io.sockets.adapter.rooms.get(roomName);
        if (roomSockets) {
            const users = Array.from(roomSockets).map(socketId => {
                const socketInstance = io.sockets.sockets.get(socketId);
                // Use the authenticatedUser object, or create a fallback with socket ID
                return socketInstance.authenticatedUser || {
                    id: socketId,
                    name: "Anonymous",
                    displayName: "Anonymous",
                    userStatus: "online"
                };
            });

            // Send to the joining user the list of active users
            socket.emit('activeUsers', {
                room: roomName,
                users: users,
                timestamp: new Date()
            });

            // Also broadcast to everyone else so they all have the latest
            socket.to(roomName).emit('activeUsers', {
                room: roomName,
                users: users,
                timestamp: new Date()
            });
        }

        console.log(`User ${socket.id} joined room ${roomName}`);
    };

    // Helper function to leave a room and notify others
    const leaveRoom = (roomName) => {
        if (!authenticatedUser) {
            console.warn(`Unauthenticated user ${socket.id} attempted to leave room ${roomName}`);
            return;
        }

        socket.leave(roomName);
        userRooms.delete(roomName);

        // Notify others in the room with consistent data structure
        socket.to(roomName).emit('userLeft', {
            userId: socket.id,
            user: authenticatedUser,
            timestamp: new Date()
        });

        // Send updated list of active users to all remaining users
        const roomSockets = io.sockets.adapter.rooms.get(roomName);
        if (roomSockets) {
            const users = Array.from(roomSockets).map(socketId => {
                const socketInstance = io.sockets.sockets.get(socketId);
                return socketInstance.authenticatedUser || {
                    id: socketId,
                    name: "Anonymous",
                    displayName: "Anonymous",
                    userStatus: "online"
                };
            });

            io.to(roomName).emit('activeUsers', {
                room: roomName,
                users: users,
                timestamp: new Date()
            });
        }

        console.log(`User ${socket.id} left room ${roomName}`);
    };

    // Helper function to get active users in a room
    const getActiveUsersInRoom = (roomName) => {
        const roomSockets = io.sockets.adapter.rooms.get(roomName);
        if (!roomSockets) return [];

        return Array.from(roomSockets).map(socketId => {
            const socketInstance = io.sockets.sockets.get(socketId);
            return socketInstance.authenticatedUser || {
                id: socketId,
                name: "Anonymous",
                displayName: "Anonymous",
                userStatus: "online"
            };
        });
    };

    // Join a workspace room
    socket.on('joinWorkspace', (workspaceId) => {
        if (!authenticatedUser) {
            console.warn(`Unauthenticated user ${socket.id} attempted to join workspace ${workspaceId}`);
            return;
        }

        // Create a room name for this workspace
        const roomName = `workspace:${workspaceId}`;
        joinRoom(roomName);
    });

    // Leave a workspace room
    socket.on('leaveWorkspace', (workspaceId) => {
        if (!authenticatedUser) {
            console.warn(`Unauthenticated user ${socket.id} attempted to leave workspace ${workspaceId}`);
            return;
        }

        const roomName = `workspace:${workspaceId}`;
        if (userRooms.has(roomName)) {
            leaveRoom(roomName);
        } else {
            console.warn(`User ${socket.id} attempted to leave a workspace room they're not in: ${roomName}`);
        }
    });

    // Join a collection room
    socket.on('joinCollection', (collectionId) => {
        if (!authenticatedUser) {
            console.warn(`Unauthenticated user ${socket.id} attempted to join collection ${collectionId}`);
            return;
        }

        const roomName = `collection:${collectionId}`;
        joinRoom(roomName);
    });

    // Leave a collection room
    socket.on('leaveCollection', (collectionId) => {
        if (!authenticatedUser) {
            console.warn(`Unauthenticated user ${socket.id} attempted to leave collection ${collectionId}`);
            return;
        }

        const roomName = `collection:${collectionId}`;
        if (userRooms.has(roomName)) {
            leaveRoom(roomName);
        } else {
            console.warn(`User ${socket.id} attempted to leave a collection room they're not in: ${roomName}`);
        }
    });

    // Handle user activity broadcasts
    socket.on('userActivity', ({ room, activity }) => {
        if (!authenticatedUser) {
            console.warn('Unauthenticated user activity received');
            return;
        }

        console.log(`Activity in ${room}:`, activity);

        // Broadcast to others in the room
        socket.to(room).emit('userActivity', {
            userId: socket.id,
            user: authenticatedUser,
            activity,
            timestamp: new Date()
        });
    });

    // Handle typing indicators
    socket.on('typingIndicator', ({ room, isTyping }) => {
        if (!authenticatedUser) return;

        socket.to(room).emit('typingIndicator', {
            userId: socket.id,
            user: authenticatedUser,
            isTyping,
            timestamp: new Date()
        });
    });

    // Handle heartbeats to keep track of active users
    socket.on('heartbeat', ({ room }) => {
        // Refresh the user's presence in the room
        if (userRooms.has(room)) {
            // Optionally broadcast to room that user is still active
            socket.to(room).emit('heartbeat', {
                userId: socket.id,
                timestamp: new Date()
            });
        }
    });

    // Request for active users in a specific room
    socket.on('getActiveUsers', ({ room }, callback) => {
        const roomSockets = io.sockets.adapter.rooms.get(room);

        if (roomSockets) {
            const users = Array.from(roomSockets).map(socketId => {
                const socketInstance = io.sockets.sockets.get(socketId);
                return socketInstance.authenticatedUser || { id: socketId };
            });

            if (callback) {
                callback(users);
            }
        } else if (callback) {
            callback([]);
        }
    });

    // NEW HANDLERS FOR VERSION CONTROL AND COLLABORATIVE EDITING

    // Handle document editing started
    socket.on('documentEditStarted', ({ room, entityType, entityId }) => {
        if (!authenticatedUser) return;

        // Broadcast to room that user started editing
        socket.to(room).emit('documentEditStarted', {
            userId: socket.id,
            user: authenticatedUser,
            entityType,
            entityId,
            timestamp: new Date()
        });

        console.log(`User ${socket.id} started editing ${entityType}:${entityId}`);
    });

    // Handle document editing ended
    socket.on('documentEditEnded', ({ room, entityType, entityId }) => {
        if (!authenticatedUser) return;

        // Broadcast to room that user stopped editing
        socket.to(room).emit('documentEditEnded', {
            userId: socket.id,
            user: authenticatedUser,
            entityType,
            entityId,
            timestamp: new Date()
        });

        console.log(`User ${socket.id} stopped editing ${entityType}:${entityId}`);
    });

    // Handle document version changed
    socket.on('documentVersionChanged', ({ room, entityType, entityId, version }) => {
        if (!authenticatedUser) return;

        // Broadcast version change to all users in the room
        socket.to(room).emit('documentVersionChanged', {
            userId: socket.id,
            user: authenticatedUser,
            entityType,
            entityId,
            version,
            timestamp: new Date()
        });

        console.log(`User ${socket.id} created new version of ${entityType}:${entityId}`);

        // Also save version to database (simplified; in production would store in MongoDB)
        try {
            // In a real implementation, this would store the version in the database
            console.log(`Saving version for ${entityType}:${entityId}`, version);

            // Log the activity
            const activityData = {
                type: 'version_created',
                entityType,
                entityId,
                userId: authenticatedUser.id,
                userName: authenticatedUser.name,
                timestamp: new Date(),
                versionId: version.id,
                changes: version.changes
            };

            // In a real implementation, store this activity
            console.log('New activity logged:', activityData);
        } catch (error) {
            console.error('Error storing version:', error);
        }
    });

    // Handle document branch created
    socket.on('documentBranchCreated', ({ room, entityType, entityId, branch }) => {
        if (!authenticatedUser) return;

        // Broadcast branch creation to all users in the room
        socket.to(room).emit('documentBranchCreated', {
            userId: socket.id,
            user: authenticatedUser,
            entityType,
            entityId,
            branch,
            timestamp: new Date()
        });

        console.log(`User ${socket.id} created branch ${branch.name} for ${entityType}:${entityId}`);
    });

    // Handle merge request created
    socket.on('mergeRequestCreated', ({ room, mergeRequest }) => {
        if (!authenticatedUser) return;

        // Broadcast merge request to all users in the room
        socket.to(room).emit('mergeRequestCreated', {
            userId: socket.id,
            user: authenticatedUser,
            mergeRequest,
            timestamp: new Date()
        });

        console.log(`User ${socket.id} created merge request: ${mergeRequest.title || mergeRequest._id}`);
    });

    // Handle disconnect
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);

        // Notify all rooms this user was in
        for (const room of userRooms) {
            socket.to(room).emit('userLeft', {
                userId: socket.id,
                user: authenticatedUser,
                timestamp: new Date(),
                reason: 'disconnect'
            });
        }

        // Clear user rooms
        userRooms.clear();
    });
});

server.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});

// Add merge request approval endpoint
app.post('/api/merge-requests/:id/approve', authenticateJWT, async (req, res) => {
    try {
        const mergeRequestId = req.params.id;
        const userId = req.user.id;

        // Find the merge request
        const mergeRequest = await db.collection('mergeRequests').findOne({
            _id: new ObjectId(mergeRequestId)
        });

        if (!mergeRequest) {
            return res.status(404).json({ message: 'Merge request not found' });
        }

        // Check if the merge request is already processed
        if (mergeRequest.status !== 'pending') {
            return res.status(400).json({ message: `Merge request already ${mergeRequest.status}` });
        }

        // Get the workspace to check user permissions
        const workspace = await db.collection('workspaces').findOne({
            _id: new ObjectId(mergeRequest.workspaceId)
        });

        // Check if user has permission (admin or editor)
        const collaborator = workspace.collaborators.find(c => c.userId === userId);
        if (!collaborator || (collaborator.role !== 'admin' && collaborator.role !== 'editor')) {
            return res.status(403).json({ message: 'You do not have permission to approve merge requests' });
        }

        // Get user details for action metadata
        const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });

        // Update the merge request status
        const result = await db.collection('mergeRequests').updateOne(
            { _id: new ObjectId(mergeRequestId) },
            {
                $set: {
                    status: 'approved',
                    actionBy: {
                        userId: userId,
                        displayName: user.displayName || user.email,
                        email: user.email
                    },
                    updatedAt: new Date()
                }
            }
        );

        if (result.modifiedCount === 0) {
            return res.status(500).json({ message: 'Failed to update merge request' });
        }

        // Process the actual merge of data from source collection to target collection
        const sourceCollection = await db.collection('collections').findOne({
            _id: new ObjectId(mergeRequest.sourceCollection._id)
        });

        const targetCollection = await db.collection('collections').findOne({
            _id: new ObjectId(mergeRequest.targetCollection._id)
        });

        // Merge requests (only add new ones or update if different)
        if (sourceCollection.requests && sourceCollection.requests.length > 0) {
            for (const sourceRequest of sourceCollection.requests) {
                // Check if request exists in target by id or URL signature
                const existingRequest = targetCollection.requests.find(r =>
                    r._id.toString() === sourceRequest._id.toString() ||
                    (r.url === sourceRequest.url && r.method === sourceRequest.method)
                );

                if (!existingRequest) {
                    // Add new request
                    const newRequest = { ...sourceRequest, mergedFrom: sourceCollection._id.toString() };
                    await db.collection('collections').updateOne(
                        { _id: targetCollection._id },
                        { $push: { requests: newRequest } }
                    );
                } else {
                    // Compare and update if needed
                    const needsUpdate = JSON.stringify(existingRequest) !== JSON.stringify(sourceRequest);
                    if (needsUpdate) {
                        // Update the existing request
                        const updatedRequest = { ...sourceRequest, mergedFrom: sourceCollection._id.toString() };
                        await db.collection('collections').updateOne(
                            {
                                _id: targetCollection._id,
                                "requests._id": existingRequest._id
                            },
                            { $set: { "requests.$": updatedRequest } }
                        );
                    }
                }
            }
        }

        // Add audit log for the merge
        await db.collection('activities').insertOne({
            type: 'merge_approved',
            workspaceId: workspace._id,
            user: {
                userId: userId,
                displayName: user.displayName || user.email,
                email: user.email
            },
            details: {
                mergeRequestId: mergeRequestId,
                sourceCollectionId: sourceCollection._id.toString(),
                sourceCollectionName: sourceCollection.name,
                targetCollectionId: targetCollection._id.toString(),
                targetCollectionName: targetCollection.name
            },
            message: `Merge from "${sourceCollection.name}" to "${targetCollection.name}" was approved by ${user.displayName || user.email}`,
            timestamp: new Date()
        });

        // Get the updated merge request to return
        const updatedMergeRequest = await db.collection('mergeRequests').findOne({
            _id: new ObjectId(mergeRequestId)
        });

        // If socket.io is available, notify collaboration users
        if (io) {
            const workspaceRoom = `workspace:${workspace._id.toString()}`;
            io.to(workspaceRoom).emit('userActivity', {
                userId: userId,
                activity: {
                    type: 'merge_approved',
                    details: {
                        mergeRequestId,
                        sourceName: sourceCollection.name,
                        targetName: targetCollection.name
                    }
                },
                timestamp: new Date()
            });
        }

        res.json(updatedMergeRequest);
    } catch (error) {
        console.error('Error approving merge request:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
});

// Add merge request rejection endpoint
app.post('/api/merge-requests/:id/reject', authenticateJWT, async (req, res) => {
    try {
        const mergeRequestId = req.params.id;
        const userId = req.user.id;

        // Find the merge request
        const mergeRequest = await db.collection('mergeRequests').findOne({
            _id: new ObjectId(mergeRequestId)
        });

        if (!mergeRequest) {
            return res.status(404).json({ message: 'Merge request not found' });
        }

        // Check if the merge request is already processed
        if (mergeRequest.status !== 'pending') {
            return res.status(400).json({ message: `Merge request already ${mergeRequest.status}` });
        }

        // Get the workspace to check user permissions
        const workspace = await db.collection('workspaces').findOne({
            _id: new ObjectId(mergeRequest.workspaceId)
        });

        // Check if user has permission (admin or editor)
        const collaborator = workspace.collaborators.find(c => c.userId === userId);
        if (!collaborator || (collaborator.role !== 'admin' && collaborator.role !== 'editor')) {
            return res.status(403).json({ message: 'You do not have permission to reject merge requests' });
        }

        // Get user details for action metadata
        const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });

        // Update the merge request status
        const result = await db.collection('mergeRequests').updateOne(
            { _id: new ObjectId(mergeRequestId) },
            {
                $set: {
                    status: 'rejected',
                    actionBy: {
                        userId: userId,
                        displayName: user.displayName || user.email,
                        email: user.email
                    },
                    updatedAt: new Date()
                }
            }
        );

        if (result.modifiedCount === 0) {
            return res.status(500).json({ message: 'Failed to update merge request' });
        }

        // Add audit log for the rejection
        const sourceCollection = await db.collection('collections').findOne({
            _id: new ObjectId(mergeRequest.sourceCollection._id)
        });

        const targetCollection = await db.collection('collections').findOne({
            _id: new ObjectId(mergeRequest.targetCollection._id)
        });

        await db.collection('activities').insertOne({
            type: 'merge_rejected',
            workspaceId: workspace._id,
            user: {
                userId: userId,
                displayName: user.displayName || user.email,
                email: user.email
            },
            details: {
                mergeRequestId: mergeRequestId,
                sourceCollectionId: sourceCollection._id.toString(),
                sourceCollectionName: sourceCollection.name,
                targetCollectionId: targetCollection._id.toString(),
                targetCollectionName: targetCollection.name
            },
            message: `Merge from "${sourceCollection.name}" to "${targetCollection.name}" was rejected by ${user.displayName || user.email}`,
            timestamp: new Date()
        });

        // Get the updated merge request to return
        const updatedMergeRequest = await db.collection('mergeRequests').findOne({
            _id: new ObjectId(mergeRequestId)
        });

        // If socket.io is available, notify collaboration users
        if (io) {
            const workspaceRoom = `workspace:${workspace._id.toString()}`;
            io.to(workspaceRoom).emit('userActivity', {
                userId: userId,
                activity: {
                    type: 'merge_rejected',
                    details: {
                        mergeRequestId,
                        sourceName: sourceCollection.name,
                        targetName: targetCollection.name
                    }
                },
                timestamp: new Date()
            });
        }

        res.json(updatedMergeRequest);
    } catch (error) {
        console.error('Error rejecting merge request:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
});

// --- VERSION CONTROL API ENDPOINTS ---

// Get version history for a workspace
app.get('/api/workspaces/:id/versions', authenticateJWT, async (req, res) => {
    try {
        const workspaceId = req.params.id;

        // In a real implementation, this would query from MongoDB
        // For now, we'll return mock version history data
        const versionHistory = [
            {
                id: `v-${Date.now()}-1`,
                entityType: 'workspace',
                entityId: workspaceId,
                userId: req.user.id,
                userName: req.user.name || 'Anonymous User',
                timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
                message: 'Updated workspace settings',
                type: 'commit',
                changes: {
                    modified: [
                        {
                            field: 'name',
                            oldValue: 'Old Workspace Name',
                            newValue: 'New Workspace Name'
                        },
                        {
                            field: 'description',
                            oldValue: 'Old description',
                            newValue: 'Updated description for the workspace'
                        }
                    ]
                }
            },
            {
                id: `v-${Date.now()}-2`,
                entityType: 'workspace',
                entityId: workspaceId,
                userId: req.user.id,
                userName: req.user.name || 'Anonymous User',
                timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
                message: 'Added new collaborator',
                type: 'commit',
                changes: {
                    added: [
                        {
                            field: 'collaborators',
                            value: {
                                userId: 'user-123',
                                displayName: 'Jane Smith',
                                email: 'jane@example.com',
                                role: 'editor'
                            }
                        }
                    ]
                }
            }
        ];

        res.json(versionHistory);
    } catch (err) {
        console.error("Error fetching workspace version history:", err);
        res.status(500).json({ message: 'Error fetching workspace version history' });
    }
});

// Get version history for a collection
app.get('/api/collections/:id/versions', authenticateJWT, async (req, res) => {
    try {
        const collectionId = req.params.id;

        // In a real implementation, this would query from MongoDB
        // For now, we'll return mock version history data
        const versionHistory = [
            {
                id: `v-${Date.now()}-3`,
                entityType: 'collection',
                entityId: collectionId,
                userId: req.user.id,
                userName: req.user.name || 'Anonymous User',
                timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
                message: 'Initial collection creation',
                type: 'commit',
                changes: {
                    added: [
                        {
                            field: 'name',
                            value: 'API Collection'
                        },
                        {
                            field: 'description',
                            value: 'Collection of API endpoints'
                        }
                    ]
                }
            },
            {
                id: `v-${Date.now()}-4`,
                entityType: 'collection',
                entityId: collectionId,
                userId: req.user.id,
                userName: req.user.name || 'Anonymous User',
                timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
                message: 'Added new request',
                type: 'commit',
                changes: {
                    added: [
                        {
                            field: 'requests',
                            value: {
                                id: 'req-123',
                                name: 'Get Users',
                                method: 'GET',
                                url: 'https://api.example.com/users'
                            }
                        }
                    ]
                }
            },
            {
                id: `v-${Date.now()}-5`,
                entityType: 'collection',
                entityId: collectionId,
                userId: req.user.id,
                userName: req.user.name || 'Anonymous User',
                timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
                message: 'Updated request parameters',
                type: 'commit',
                changes: {
                    modified: [
                        {
                            field: 'requests[0].url',
                            oldValue: 'https://api.example.com/users',
                            newValue: 'https://api.example.com/users?page=1&limit=10'
                        }
                    ]
                }
            }
        ];

        res.json(versionHistory);
    } catch (err) {
        console.error("Error fetching collection version history:", err);
        res.status(500).json({ message: 'Error fetching collection version history' });
    }
});

// Save a new version for a workspace
app.post('/api/workspaces/:id/versions', authenticateJWT, async (req, res) => {
    try {
        const workspaceId = req.params.id;
        const { changes, message, userId } = req.body;

        if (!changes) {
            return res.status(400).json({ message: 'Changes are required' });
        }

        // In a real implementation, this would save to MongoDB
        // For now, we'll just create a mock version object and return it
        const newVersion = {
            id: `v-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            entityType: 'workspace',
            entityId: workspaceId,
            userId: userId || req.user.id,
            userName: req.user.name || 'Anonymous User',
            timestamp: new Date(),
            message: message || 'Updated workspace',
            type: 'commit',
            changes
        };

        // Log the created version
        console.log('Created new workspace version:', newVersion);

        res.status(201).json(newVersion);
    } catch (err) {
        console.error("Error saving workspace version:", err);
        res.status(500).json({ message: 'Error saving workspace version' });
    }
});

// Save a new version for a collection
app.post('/api/collections/:id/versions', authenticateJWT, async (req, res) => {
    try {
        const collectionId = req.params.id;
        const { changes, message, userId } = req.body;

        if (!changes) {
            return res.status(400).json({ message: 'Changes are required' });
        }

        // In a real implementation, this would save to MongoDB
        // For now, we'll just create a mock version object and return it
        const newVersion = {
            id: `v-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            entityType: 'collection',
            entityId: collectionId,
            userId: userId || req.user.id,
            userName: req.user.name || 'Anonymous User',
            timestamp: new Date(),
            message: message || 'Updated collection',
            type: 'commit',
            changes
        };

        // Log the created version
        console.log('Created new collection version:', newVersion);

        res.status(201).json(newVersion);
    } catch (err) {
        console.error("Error saving collection version:", err);
        res.status(500).json({ message: 'Error saving collection version' });
    }
});

// Create a merge request
app.post('/api/:entityType/:id/merge-request', authenticateJWT, async (req, res) => {
    try {
        const { entityType, id } = req.params;
        const { targetId, title, description, userId } = req.body;

        if (!targetId) {
            return res.status(400).json({ message: 'Target ID is required' });
        }

        // In a real implementation, this would save to MongoDB
        // For now, we'll just create a mock merge request object and return it
        const mergeRequest = {
            id: `mr-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            sourceType: entityType,
            sourceId: id,
            targetType: entityType,
            targetId,
            title: title || `Merge ${entityType} ${id} to ${targetId}`,
            description: description || '',
            status: 'pending',
            createdBy: {
                userId: userId || req.user.id,
                name: req.user.name || 'Anonymous User',
                email: req.user.email || 'anonymous@example.com'
            },
            createdAt: new Date(),
            updatedAt: new Date()
        };

        // Log the created merge request
        console.log('Created new merge request:', mergeRequest);

        res.status(201).json(mergeRequest);
    } catch (err) {
        console.error("Error creating merge request:", err);
        res.status(500).json({ message: 'Error creating merge request' });
    }
});

// --- VERSION CONTROL & BRANCH MANAGEMENT API ENDPOINTS ---

// Get branches for a collection
app.get('/api/collections/:id/branches', authenticateJWT, async (req, res) => {
    try {
        const collectionId = req.params.id;

        // In a real implementation, this would query branches from MongoDB
        // For now, we'll return mock branch data
        const branches = [
            {
                id: `branch-${Date.now()}-1`,
                name: 'feature/auth-endpoints',
                description: 'Adding new OAuth2 authentication endpoints',
                collectionId: collectionId,
                basedOn: 'main',
                createdBy: req.user.id,
                createdByName: req.user.name || 'Anonymous User',
                createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
                lastCommit: {
                    id: `commit-${Date.now()}-1`,
                    message: 'Updated token endpoint',
                    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // 2 days ago
                }
            },
            {
                id: `branch-${Date.now()}-2`,
                name: 'bugfix/rate-limiting',
                description: 'Fix rate limiting issues on API endpoints',
                collectionId: collectionId,
                basedOn: 'main',
                createdBy: req.user.id,
                createdByName: req.user.name || 'Anonymous User',
                createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
                lastCommit: {
                    id: `commit-${Date.now()}-2`,
                    message: 'Added proper headers for rate limits',
                    timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) // 1 day ago
                }
            }
        ];

        res.json(branches);
    } catch (err) {
        console.error("Error fetching collection branches:", err);
        res.status(500).json({ message: 'Error fetching branches' });
    }
});

// Create a new branch for a collection
app.post('/api/collections/:id/branches', authenticateJWT, async (req, res) => {
    try {
        const collectionId = req.params.id;
        const { name, description, baseBranch } = req.body;

        if (!name) {
            return res.status(400).json({ message: 'Branch name is required' });
        }

        // In a real implementation, this would create a branch in MongoDB
        // For now, we'll create a mock branch object
        const newBranch = {
            id: `branch-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            name,
            description,
            collectionId,
            basedOn: baseBranch || 'main',
            createdBy: req.user.id,
            createdByName: req.user.name || 'Anonymous User',
            createdAt: new Date(),
            lastCommit: null
        };

        console.log(`Created new branch: ${newBranch.name} for collection ${collectionId}`);

        res.status(201).json(newBranch);
    } catch (err) {
        console.error("Error creating collection branch:", err);
        res.status(500).json({ message: 'Error creating branch' });
    }
});

// Switch active branch for a collection
app.post('/api/collections/:id/switch-branch', authenticateJWT, async (req, res) => {
    try {
        const collectionId = req.params.id;
        const { branchName } = req.body;

        if (!branchName) {
            return res.status(400).json({ message: 'Branch name is required' });
        }

        // In a real implementation, this would update the user's active branch for this collection
        // For now, we'll just return a mock updated collection
        const updatedCollection = {
            _id: collectionId,
            name: "Updated Collection View",
            description: "Now viewing a different branch",
            activeBranch: branchName,
            updatedAt: new Date(),
            branches: [
                { name: 'main' },
                { name: branchName }
            ],
            // Other collection properties would be here
        };

        console.log(`Switched to branch ${branchName} for collection ${collectionId}`);

        res.json(updatedCollection);
    } catch (err) {
        console.error("Error switching collection branch:", err);
        res.status(500).json({ message: 'Error switching branch' });
    }
});

// Get diff between collections or branches
app.post('/api/collections/diff', authenticateJWT, async (req, res) => {
    try {
        const { sourceId, targetId, sourceBranch, targetBranch } = req.body;

        if (!sourceId || !targetId) {
            return res.status(400).json({ message: 'Source and target IDs are required' });
        }

        // In a real implementation, this would calculate actual diffs between collections or branches
        // For now, we'll return mock diff data
        const diffData = {
            summary: {
                added: 3,
                modified: 2,
                deleted: 1
            },
            added: [
                {
                    path: '/requests/0',
                    type: 'request',
                    value: {
                        name: 'New GET Request',
                        url: 'https://api.example.com/v1/users',
                        method: 'GET',
                        headers: [
                            { name: 'Content-Type', value: 'application/json' }
                        ]
                    }
                },
                {
                    path: '/requests/1',
                    type: 'request',
                    value: {
                        name: 'New POST Request',
                        url: 'https://api.example.com/v1/users',
                        method: 'POST',
                        headers: [
                            { name: 'Content-Type', value: 'application/json' }
                        ],
                        body: { type: 'json', content: '{"name": "John Doe", "email": "john@example.com"}' }
                    }
                },
                {
                    path: '/folders/0',
                    type: 'folder',
                    value: {
                        name: 'New Authentication Folder'
                    }
                }
            ],
            modified: [
                {
                    path: '/requests/2',
                    type: 'request',
                    oldValue: {
                        name: 'Old Request Name',
                        url: 'https://api.example.com/v1/items',
                        method: 'GET'
                    },
                    newValue: {
                        name: 'Updated Request Name',
                        url: 'https://api.example.com/v2/items',
                        method: 'GET',
                        headers: [
                            { name: 'Authorization', value: 'Bearer {{token}}' }
                        ]
                    },
                    changes: [
                        {
                            field: 'name',
                            oldValue: 'Old Request Name',
                            newValue: 'Updated Request Name'
                        },
                        {
                            field: 'url',
                            oldValue: 'https://api.example.com/v1/items',
                            newValue: 'https://api.example.com/v2/items'
                        },
                        {
                            field: 'headers',
                            oldValue: [],
                            newValue: [{ name: 'Authorization', value: 'Bearer {{token}}' }]
                        }
                    ]
                },
                {
                    path: '/description',
                    type: 'metadata',
                    oldValue: 'Old collection description',
                    newValue: 'Updated collection description with more details',
                    changes: [
                        {
                            field: 'description',
                            oldValue: 'Old collection description',
                            newValue: 'Updated collection description with more details'
                        }
                    ]
                }
            ],
            deleted: [
                {
                    path: '/requests/3',
                    type: 'request',
                    value: {
                        name: 'Deleted Request',
                        url: 'https://api.example.com/v1/deprecated',
                        method: 'DELETE'
                    }
                }
            ]
        };

        res.json(diffData);
    } catch (err) {
        console.error("Error generating diff:", err);
        res.status(500).json({ message: 'Error generating diff' });
    }
});

// Check for merge conflicts
app.post('/api/collections/:id/check-conflicts', authenticateJWT, async (req, res) => {
    try {
        const sourceCollectionId = req.params.id;
        const { targetCollectionId, sourceBranch, targetBranch } = req.body;

        if (!targetCollectionId) {
            return res.status(400).json({ message: 'Target collection ID is required' });
        }

        // In a real implementation, this would check for actual conflicts
        // For demonstration, we'll sometimes return conflicts and sometimes not
        // to show both flows
        const hasConflicts = Math.random() > 0.5;

        if (!hasConflicts) {
            // No conflicts
            return res.json([]);
        }

        // Mock conflicts
        const conflicts = [
            {
                id: `conflict-${Date.now()}-1`,
                path: '/requests/2',
                type: 'request',
                source: {
                    name: 'User Authentication',
                    url: 'https://api.example.com/v1/auth',
                    method: 'POST',
                    headers: [
                        { name: 'Content-Type', value: 'application/json' }
                    ],
                    body: {
                        type: 'json',
                        content: '{"username": "user", "password": "pass", "remember_me": true}'
                    }
                },
                target: {
                    name: 'User Authentication',
                    url: 'https://api.example.com/v2/auth',
                    method: 'POST',
                    headers: [
                        { name: 'Content-Type', value: 'application/json' },
                        { name: 'X-API-Version', value: '2.0' }
                    ],
                    body: {
                        type: 'json',
                        content: '{"email": "user@example.com", "password": "pass"}'
                    }
                }
            },
            {
                id: `conflict-${Date.now()}-2`,
                path: '/environment/variables/apiKey',
                type: 'environment',
                source: {
                    key: 'apiKey',
                    value: '1234567890',
                    description: 'API key for v1'
                },
                target: {
                    key: 'apiKey',
                    value: 'abcdefghijklmn',
                    description: 'API key for production'
                }
            }
        ];

        res.json(conflicts);
    } catch (err) {
        console.error("Error checking for conflicts:", err);
        res.status(500).json({ message: 'Error checking for conflicts' });
    }
});

// Resolve merge conflicts
app.post('/api/collections/:id/resolve-conflicts', authenticateJWT, async (req, res) => {
    try {
        const sourceCollectionId = req.params.id;
        const { targetCollectionId, resolutions } = req.body;

        if (!targetCollectionId || !resolutions) {
            return res.status(400).json({ message: 'Target collection ID and resolutions are required' });
        }

        // In a real implementation, this would resolve the conflicts according to the provided resolutions
        // For now, we'll just log the resolutions and return success
        console.log(`Resolving conflicts from ${sourceCollectionId} to ${targetCollectionId}`);
        console.log('Resolutions:', JSON.stringify(resolutions, null, 2));

        res.json({
            message: 'Conflicts resolved successfully',
            resolvedConflicts: Object.keys(resolutions).length
        });
    } catch (err) {
        console.error("Error resolving conflicts:", err);
        res.status(500).json({ message: 'Error resolving conflicts' });
    }
});

// --- SAMPLE DATA MANAGEMENT ENDPOINTS ---

// Get all sample data sets for a collection
app.get('/api/collections/:id/sample-data', ensureAuthenticated, async (req, res) => {
    try {
        const collectionId = req.params.id;

        // In a real implementation, this would query from MongoDB
        // For now, we'll return mock sample data

        // Check if we have existing data stored for this collection
        if (!global.sampleDataStore) {
            global.sampleDataStore = {};
        }

        if (!global.sampleDataStore[collectionId]) {
            // Initialize with some example data
            global.sampleDataStore[collectionId] = [
                {
                    _id: `sample-${Date.now()}-1`,
                    name: 'Login Credentials',
                    collectionId,
                    content: {
                        username: 'testuser',
                        password: 'password123',
                        rememberMe: true
                    },
                    createdBy: req.user.id,
                    createdAt: new Date(),
                    updatedAt: new Date()
                },
                {
                    _id: `sample-${Date.now()}-2`,
                    name: 'User Profile Data',
                    collectionId,
                    content: {
                        firstName: 'John',
                        lastName: 'Doe',
                        email: 'john.doe@example.com',
                        age: 30,
                        preferences: {
                            theme: 'dark',
                            notifications: true
                        }
                    },
                    createdBy: req.user.id,
                    createdAt: new Date(),
                    updatedAt: new Date()
                }
            ];
        }

        res.json(global.sampleDataStore[collectionId]);
    } catch (err) {
        console.error("Error fetching sample data:", err);
        res.status(500).json({ message: 'Error fetching sample data' });
    }
});

// Create new sample dataset
app.post('/api/collections/:id/sample-data', ensureAuthenticated, async (req, res) => {
    try {
        const collectionId = req.params.id;
        const { name, content } = req.body;

        if (!name) {
            return res.status(400).json({ message: 'Dataset name is required' });
        }

        // Ensure our global store exists
        if (!global.sampleDataStore) {
            global.sampleDataStore = {};
        }

        if (!global.sampleDataStore[collectionId]) {
            global.sampleDataStore[collectionId] = [];
        }

        // Create new sample data set
        const newSampleData = {
            _id: `sample-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            name,
            collectionId,
            content: content || {},
            createdBy: req.user.id,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        global.sampleDataStore[collectionId].push(newSampleData);
        console.log(`Created new sample dataset "${name}" for collection ${collectionId}`);

        res.status(201).json(newSampleData);
    } catch (err) {
        console.error("Error creating sample data:", err);
        res.status(500).json({ message: 'Error creating sample data' });
    }
});

// Update a sample dataset
app.put('/api/collections/:collectionId/sample-data/:datasetId', ensureAuthenticated, async (req, res) => {
    try {
        const { collectionId, datasetId } = req.params;
        const { content } = req.body;

        // Ensure our global store exists
        if (!global.sampleDataStore || !global.sampleDataStore[collectionId]) {
            return res.status(404).json({ message: 'Collection not found' });
        }

        // Find the dataset to update
        const datasetIndex = global.sampleDataStore[collectionId].findIndex(ds => ds._id === datasetId);
        if (datasetIndex === -1) {
            return res.status(404).json({ message: 'Sample dataset not found' });
        }

        // Update the dataset
        global.sampleDataStore[collectionId][datasetIndex] = {
            ...global.sampleDataStore[collectionId][datasetIndex],
            content: content || {},
            updatedAt: new Date()
        };

        console.log(`Updated sample dataset "${global.sampleDataStore[collectionId][datasetIndex].name}" for collection ${collectionId}`);

        res.json(global.sampleDataStore[collectionId][datasetIndex]);
    } catch (err) {
        console.error("Error updating sample data:", err);
        res.status(500).json({ message: 'Error updating sample data' });
    }
});

// Delete a sample dataset
app.delete('/api/collections/:collectionId/sample-data/:datasetId', ensureAuthenticated, async (req, res) => {
    try {
        const { collectionId, datasetId } = req.params;

        // Ensure our global store exists
        if (!global.sampleDataStore || !global.sampleDataStore[collectionId]) {
            return res.status(404).json({ message: 'Collection not found' });
        }

        // Find the dataset to delete
        const datasetIndex = global.sampleDataStore[collectionId].findIndex(ds => ds._id === datasetId);
        if (datasetIndex === -1) {
            return res.status(404).json({ message: 'Sample dataset not found' });
        }

        // Delete the dataset
        const deletedDataset = global.sampleDataStore[collectionId].splice(datasetIndex, 1)[0];
        console.log(`Deleted sample dataset "${deletedDataset.name}" from collection ${collectionId}`);

        res.json({ message: 'Sample dataset deleted successfully' });
    } catch (err) {
        console.error("Error deleting sample data:", err);
        res.status(500).json({ message: 'Error deleting sample data' });
    }
});

// Get a specific sample dataset
app.get('/api/collections/:collectionId/sample-data/:datasetId', ensureAuthenticated, async (req, res) => {
    try {
        const { collectionId, datasetId } = req.params;

        // Ensure our global store exists
        if (!global.sampleDataStore || !global.sampleDataStore[collectionId]) {
            return res.status(404).json({ message: 'Collection not found' });
        }

        // Find the dataset
        const dataset = global.sampleDataStore[collectionId].find(ds => ds._id === datasetId);
        if (!dataset) {
            return res.status(404).json({ message: 'Sample dataset not found' });
        }

        res.json(dataset);
    } catch (err) {
        console.error("Error fetching sample dataset:", err);
        res.status(500).json({ message: 'Error fetching sample dataset' });
    }
});