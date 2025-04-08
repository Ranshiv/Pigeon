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
const Collection = require('./models/Collection');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 5000;

const User = require('./models/User');
const History = require('./models/History');
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
    callbackURL: 'http://localhost:5000/auth/google/callback',
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

    try {
        const requestDoc = await Request.findById(req.params.id);
        if (!requestDoc) {
            return res.status(404).json({ message: 'Request not found' });
        }

        const { url, method, headers, body, bodyType } = requestDoc;

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

        const externalResponse = await fetch(url, fetchOptions);
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

        // --- Send Response to Frontend ---
        const frontendResponse = {
            status: responseStatus,
            statusText: responseStatusText,
            headers: responseHeadersObj,
            body: parsedResponseBody,
            isJson: isJson, // Send flag to frontend
            duration: duration,
            size: responseSize
        };
        res.json(frontendResponse);

        // --- Save History (After Sending Response) ---
        try {
            const historyEntry = new History({
                userId: req.user.id, // Associate with logged-in user
                url: url,
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
                originalRequestId: requestDoc._id // Link to the saved request
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
            duration: duration
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

// --- NEW: History Route ---
app.get('/api/history', ensureAuthenticated, async (req, res) => {
    try {
        const history = await History.find({ userId: req.user.id })
            .sort({ timestamp: -1 }) // Sort by newest first
            .limit(50); // Limit to latest 50 entries (for now)
        res.json(history);
    } catch (err) {
        console.error("Error fetching history:", err);
        res.status(500).json({ message: 'Error fetching history', error: err.message });
    }
});

// Collection routes
app.post('/api/collections', ensureAuthenticated, async (req, res) => {
    try {
        const collection = new Collection({
            ...req.body,
            author: req.user._id
        });
        const savedCollection = await collection.save();
        res.status(201).json(savedCollection);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Get all public collections
app.get('/api/collections', async (req, res) => {
    try {
        const collections = await Collection.find({ isPublic: true })
            .populate('author', 'displayName')
            .sort({ stars: -1 });
        res.json(collections);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Fork a collection
app.post('/api/collections/:id/fork', ensureAuthenticated, async (req, res) => {
    try {
        const originalCollection = await Collection.findById(req.params.id);
        if (!originalCollection) {
            return res.status(404).json({ message: 'Collection not found' });
        }

        // Create new collection as a fork
        const forkedCollection = new Collection({
            name: `${originalCollection.name} (Fork)`,
            description: originalCollection.description,
            author: req.user._id,
            requests: [...originalCollection.requests],
            category: originalCollection.category,
            forkedFrom: originalCollection._id,
            stars: 0
        });

        const savedFork = await forkedCollection.save();
        res.status(201).json(savedFork);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Cache for API data to avoid frequent external requests
let apiCache = {
    data: [],
    lastUpdated: null
};

// Function to fetch and cache APIs
async function fetchAndCacheAPIs() {
    try {
        // Using a curated list of popular APIs
        apiCache.data = [
            {
                name: "GitHub REST API",
                description: "Access GitHub's features and data programmatically",
                category: "Development",
                url: "https://api.github.com",
                auth: "OAuth",
                https: true,
                cors: "yes"
            },
            {
                name: "OpenWeatherMap",
                description: "Current and forecast weather data",
                category: "Weather",
                url: "https://api.openweathermap.org",
                auth: "apiKey",
                https: true,
                cors: "yes"
            },
            {
                name: "Spotify Web API",
                description: "Music catalog and playback control",
                category: "Music",
                url: "https://api.spotify.com",
                auth: "OAuth",
                https: true,
                cors: "yes"
            },
            {
                name: "Twitter API v2",
                description: "Access Twitter data and functionality",
                category: "Social",
                url: "https://api.twitter.com/2",
                auth: "OAuth",
                https: true,
                cors: "yes"
            },
            {
                name: "Google Maps API",
                description: "Maps, geocoding and places data",
                category: "Mapping",
                url: "https://maps.googleapis.com",
                auth: "apiKey",
                https: true,
                cors: "yes"
            },
            {
                name: "NASA API",
                description: "Space and astronomy data",
                category: "Science",
                url: "https://api.nasa.gov",
                auth: "apiKey",
                https: true,
                cors: "yes"
            },
            {
                name: "CoinGecko",
                description: "Cryptocurrency prices and market data",
                category: "Finance",
                url: "https://api.coingecko.com/api/v3",
                auth: "none",
                https: true,
                cors: "yes"
            },
            {
                name: "JSONPlaceholder",
                description: "Fake REST API for testing and prototyping",
                category: "Development",
                url: "https://jsonplaceholder.typicode.com",
                auth: "none",
                https: true,
                cors: "yes"
            },
            {
                name: "Dog API",
                description: "Dog breeds, images and facts",
                category: "Animals",
                url: "https://dog.ceo/api",
                auth: "none",
                https: true,
                cors: "yes"
            },
            {
                name: "News API",
                description: "Headlines and news articles from various sources",
                category: "News",
                url: "https://newsapi.org",
                auth: "apiKey",
                https: true,
                cors: "yes"
            },
            {
                name: "OpenAI API",
                description: "Access GPT models and AI capabilities",
                category: "AI",
                url: "https://api.openai.com",
                auth: "apiKey",
                https: true,
                cors: "yes"
            },
            {
                name: "Cloudinary API",
                description: "Cloud-based image and video management",
                category: "Media",
                url: "https://api.cloudinary.com",
                auth: "apiKey",
                https: true,
                cors: "yes"
            },
            {
                name: "Stripe API",
                description: "Online payment processing",
                category: "Finance",
                url: "https://api.stripe.com",
                auth: "apiKey",
                https: true,
                cors: "yes"
            },
            {
                name: "MongoDB Atlas API",
                description: "Database management and operations",
                category: "Database",
                url: "https://cloud.mongodb.com/api",
                auth: "apiKey",
                https: true,
                cors: "yes"
            },
            {
                name: "SendGrid API",
                description: "Email delivery and management",
                category: "Communication",
                url: "https://api.sendgrid.com",
                auth: "apiKey",
                https: true,
                cors: "yes"
            },
            {
                name: "YouTube Data API",
                description: "Access YouTube content and features",
                category: "Media",
                url: "https://www.googleapis.com/youtube/v3",
                auth: "apiKey",
                https: true,
                cors: "yes"
            },
            {
                name: "Discord API",
                description: "Build bots and integrate with Discord",
                category: "Communication",
                url: "https://discord.com/api",
                auth: "OAuth",
                https: true,
                cors: "yes"
            },
            {
                name: "LinkedIn API",
                description: "Professional network integration",
                category: "Social",
                url: "https://api.linkedin.com",
                auth: "OAuth",
                https: true,
                cors: "yes"
            },
            {
                name: "Twilio API",
                description: "SMS, voice, and messaging services",
                category: "Communication",
                url: "https://api.twilio.com",
                auth: "apiKey",
                https: true,
                cors: "yes"
            },
            {
                name: "ChatGPT API",
                description: "Natural language processing and generation",
                category: "AI",
                url: "https://api.openai.com/v1/chat",
                auth: "apiKey",
                https: true,
                cors: "yes"
            }
        ];
        apiCache.lastUpdated = new Date();
        console.log('API cache initialized with default APIs');
    } catch (error) {
        console.error('Error initializing APIs:', error);
        if (!apiCache.data.length) {
            apiCache.data = []; // Ensure we have at least an empty array
        }
    }
}

// Update cache every 24 hours
setInterval(fetchAndCacheAPIs, 24 * 60 * 60 * 1000);
// Initial fetch
fetchAndCacheAPIs();

// Search endpoint for APIs
app.get('/api/search', async (req, res) => {
    try {
        const { query, category } = req.query;
        
        // If query is empty, return a specific message
        if (!query && category === 'all') {
            return res.status(400).json({ 
                message: 'Please enter a search term to find APIs',
                isEmpty: true
            });
        }
        
        // Search in cached APIs
        let apiResults = apiCache.data;
        
        if (query) {
            const searchQuery = query.toLowerCase();
            apiResults = apiResults.filter(api => 
                api.name.toLowerCase().includes(searchQuery) ||
                api.description.toLowerCase().includes(searchQuery) ||
                api.category.toLowerCase().includes(searchQuery)
            );
        }
        
        if (category && category !== 'all') {
            apiResults = apiResults.filter(api => 
                api.category.toLowerCase() === category.toLowerCase()
            );
        }

        // Sort results by relevance (name matches first)
        if (query) {
            const searchQuery = query.toLowerCase();
            apiResults.sort((a, b) => {
                const aNameMatch = a.name.toLowerCase().includes(searchQuery);
                const bNameMatch = b.name.toLowerCase().includes(searchQuery);
                if (aNameMatch && !bNameMatch) return -1;
                if (!aNameMatch && bNameMatch) return 1;
                return 0;
            });
        }

        res.json(apiResults);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Add request to collection
app.post('/api/collections/:collectionId/requests', ensureAuthenticated, async (req, res) => {
    try {
        const collection = await Collection.findById(req.params.collectionId);
        if (!collection) {
            return res.status(404).json({ message: 'Collection not found' });
        }

        // Check if user owns the collection
        if (collection.author.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to modify this collection' });
        }

        const requestId = req.body.requestId;
        if (!requestId) {
            return res.status(400).json({ message: 'Request ID is required' });
        }

        // Check if request exists
        const request = await Request.findById(requestId);
        if (!request) {
            return res.status(404).json({ message: 'Request not found' });
        }

        // Add request to collection if not already present
        if (!collection.requests.includes(requestId)) {
            collection.requests.push(requestId);
            await collection.save();
        }

        res.json(collection);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Remove request from collection
app.delete('/api/collections/:collectionId/requests/:requestId', ensureAuthenticated, async (req, res) => {
    try {
        const collection = await Collection.findById(req.params.collectionId);
        if (!collection) {
            return res.status(404).json({ message: 'Collection not found' });
        }

        // Check if user owns the collection
        if (collection.author.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to modify this collection' });
        }

        collection.requests = collection.requests.filter(
            req => req.toString() !== req.params.requestId
        );
        await collection.save();

        res.json(collection);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Get popular APIs (based on usage in the last week)
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
                    _id: { url: "$url", method: "$method" },
                    count: { $sum: 1 },
                    lastUsed: { $max: "$timestamp" },
                    name: { $first: "$url" },
                    method: { $first: "$method" }
                }
            },
            { $sort: { count: -1 } },
            { $limit: 6 }
        ]);

        res.json(popularAPIs);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Get trending APIs (based on recent increased usage)
app.get('/api/trending-apis', ensureAuthenticated, async (req, res) => {
    try {
        const oneDayAgo = new Date();
        oneDayAgo.setDate(oneDayAgo.getDate() - 1);

        const trendingAPIs = await History.aggregate([
            {
                $match: {
                    timestamp: { $gte: oneDayAgo }
                }
            },
            {
                $group: {
                    _id: { url: "$url", method: "$method" },
                    count: { $sum: 1 },
                    lastUsed: { $max: "$timestamp" },
                    name: { $first: "$url" },
                    method: { $first: "$method" }
                }
            },
            { $sort: { lastUsed: -1, count: -1 } },
            { $limit: 6 }
        ]);

        res.json(trendingAPIs);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Get recommended collections based on user's activity
app.get('/api/recommended-collections', ensureAuthenticated, async (req, res) => {
    try {
        // Get user's recent API categories from history
        const userHistory = await History.find({ userId: req.user._id })
            .sort({ timestamp: -1 })
            .limit(10);

        // Extract unique categories from user's APIs
        const userCategories = [...new Set(userHistory.map(h => {
            const urlParts = new URL(h.url).pathname.split('/');
            return urlParts[1] || 'other';
        }))];

        // Find collections with similar categories
        const recommendedCollections = await Collection.find({
            isPublic: true,
            category: { $in: userCategories }
        })
        .populate('author', 'displayName')
        .sort({ stars: -1 })
        .limit(6);

        res.json(recommendedCollections);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});