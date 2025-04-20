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
const ensureAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    res.status(401).json({ message: 'Unauthorized' });
};

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

app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});