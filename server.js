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

const app = express();
const port = process.env.PORT || 5001;

const User = require('./models/User');
const History = require('./models/History');
// Add global environment store (add this after other requires)
const userEnvironments = {}; // Store environment variables by user ID
// Import the scriptRunner utility
const { executePreRequestScript, executeTestScript } = require('./utils/scriptRunner');

// Store for workspaces to persist names and other properties when editing
const workspacesStore = {
    // Default workspaces
    "ws1": {
        _id: "ws1",
        name: "Personal Workspace",
        description: "My default personal workspace",
        isPersonal: true,
        isPublic: false
    },
    "ws2": {
        _id: "ws2",
        name: "API Testing Team",
        description: "Team workspace for API testing and documentation",
        isPersonal: false,
        isPublic: false
    },
    "ws3": {
        _id: "ws3",
        name: "Public Documentation",
        description: "Public API documentation workspace",
        isPersonal: false,
        isPublic: true
    }
};
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

// Get collections for a workspace
app.get('/api/workspaces/:id/collections', ensureAuthenticated, async (req, res) => {
    try {
        // Mock collections data
        const collections = [
            {
                _id: "coll1",
                name: "Sample Collection",
                description: "This is a sample API collection",
                workspaceId: req.params.id,
                requestsCount: 3,
                createdAt: new Date(),
                updatedAt: new Date()
            }
        ];

        res.json(collections);
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
        // Just return success
        res.status(200).json({ message: "Collaborator removed successfully" });
    } catch (err) {
        console.error("Error removing collaborator:", err);
        res.status(500).json({ message: 'Error removing collaborator' });
    }
});

// Update a collaborator's role
app.patch('/api/workspaces/:id/collaborators/:userId', ensureAuthenticated, async (req, res) => {
    try {
        const { role } = req.body;

        // Mock updated collaborator data
        const updatedCollaborator = {
            userId: req.params.userId,
            role: role
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

        // Mock collection data based on ID
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
                        { _id: "req7", name: "Get Profile", method: "GET", url: "https://api.example.com/profile" },
                        // Add more requests here
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
                        { _id: "req9", name: "Currency Exchange", method: "GET", url: "https://api.exchange.com/rates" },
                        // Add more requests here
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
                        { _id: "req11", name: "Get Team Members", method: "GET", url: "https://api.team.com/members" },
                        // Add more requests here
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
                return res.status(404).json({ message: 'Collection not found' });
        }

        res.json(collection);
    } catch (err) {
        console.error("Error fetching collection:", err);
        res.status(500).json({ message: 'Error fetching collection' });
    }
});

// Create a new collection
app.post('/api/collections', ensureAuthenticated, async (req, res) => {
    try {
        const { name, description } = req.body;
        const userId = req.user.id;

        // Validate required fields
        if (!name) {
            return res.status(400).json({ message: 'Collection name is required' });
        }

        // Mock creating a new collection
        const newCollection = {
            _id: "coll" + Date.now().toString(),
            name,
            description: description || "",
            isPublic: false,
            owner: userId,
            requestCount: 0,
            collaborators: [],
            createdAt: new Date(),
            updatedAt: new Date()
        };

        res.status(201).json(newCollection);
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

// --- WORKSPACE ROUTES ---

// Get all workspaces
app.get('/api/workspaces', ensureAuthenticated, async (req, res) => {
    try {
        const userId = req.user.id;

        // Mock workspaces data
        const personalWorkspaces = [
            {
                _id: "ws1",
                name: "Personal Workspace",
                description: "My default personal workspace",
                isPersonal: true,
                isPublic: false,
                owner: userId,
                memberCount: 1,
                collectionCount: 2,
                createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
                updatedAt: new Date()
            }
        ];

        const teamWorkspaces = [
            {
                _id: "ws2",
                name: "API Testing Team",
                description: "Team workspace for API testing and documentation",
                isPersonal: false,
                isPublic: false,
                owner: "other-user-id",
                userRole: "editor",
                memberCount: 5,
                collectionCount: 8,
                createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15 days ago
                updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // 2 days ago
            },
            {
                _id: "ws3",
                name: "Public Documentation",
                description: "Public API documentation workspace",
                isPersonal: false,
                isPublic: true,
                owner: "another-user-id",
                userRole: "viewer",
                memberCount: 12,
                collectionCount: 4,
                createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 60 days ago
                updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) // 5 days ago
            }
        ];

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

        // Create a workspace ID
        const newWorkspaceId = "ws" + Date.now().toString();

        // Store the workspace data in our workspacesStore
        workspacesStore[newWorkspaceId] = {
            _id: newWorkspaceId,
            name: name,
            description: description || "",
            isPersonal: isPersonal || false,
            isPublic: isPublic || false
        };

        // Mock creating a new workspace
        const newWorkspace = {
            _id: newWorkspaceId,
            name: name, // Use the name provided by the user
            description: description || "",
            isPersonal: isPersonal || false,
            isPublic: isPublic || false,
            owner: userId,
            userRole: "admin",
            memberCount: 1,
            collectionCount: 0,
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

        res.status(201).json(newWorkspace);
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

app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});