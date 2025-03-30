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

const app = express();
const port = process.env.PORT || 5000;

const User = require('./models/User');
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

app.put('/api/user/profile', ensureAuthenticated, async (req, res) => {
    try {
        const { displayName, theme } = req.body;
        const userId = req.user.id; // Get user ID from the authenticated session

        const updateData = {};
        if (displayName) {
            updateData.displayName = displayName;
        }
        if (theme && ['light', 'dark'].includes(theme)) { // Validate theme
            updateData.theme = theme;
        }

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ message: 'No valid fields to update' });
        }

        const updatedUser = await User.findByIdAndUpdate(userId, updateData, { new: true });

        if (!updatedUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Important: Update the user object in the session as well
        req.login(updatedUser, (err) => {
            if (err) {
                console.error("Error updating session user:", err);
                // Still return the updated user, but log the session error
            }
            res.json({ message: 'Profile updated successfully', user: updatedUser });
        });

    } catch (err) {
        console.error("Error updating profile:", err);
        res.status(500).json({ message: 'Error updating profile', error: err.message });
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
app.post('/api/requests/:id/send', async (req, res) => {
    try {
        // console.log("Request ID:", req.params.id); // Add this line for debugging
        const request = await Request.findById(req.params.id);
        if (!request) {
            return res.status(404).json({ message: 'Request not found' });
        }

        const { url, method, headers, body, bodyType } = request;

        const fetchOptions = {
            method,
            headers: headers.reduce((acc, { name, value }) => {
                acc[name] = value;
                return acc;
            }, {}),
        };
        // console.log("Body Type:", bodyType);
        // console.log("Body Content:", body);
        if (body && bodyType !== 'none') {
            if (bodyType === 'json') {
                fetchOptions.headers['Content-Type'] = 'application/json';
                fetchOptions.body = body;
            } else if (bodyType === 'x-www-form-urlencoded') {
                fetchOptions.headers['Content-Type'] = 'application/x-www-form-urlencoded';
                const encodedBody = new URLSearchParams(JSON.parse(body)).toString();

                fetchOptions.body = encodedBody;

            }
            else {
                // For 'raw' or other types, send the body as is (assuming it's a string)
                fetchOptions.body = body;
            }
        }

        const response = await fetch(url, fetchOptions);
        // console.log("Fetch Response:", response);

        const responseHeaders = {};
        response.headers.forEach((value, name) => {
            responseHeaders[name] = value;
        });

        const responseBody = await response.text();
        let parsedResponseBody;
        try {
            parsedResponseBody = JSON.parse(responseBody)
        } catch (error) {
            parsedResponseBody = responseBody
        }

        res.json({
            status: response.status,
            statusText: response.statusText,
            headers: responseHeaders,
            body: parsedResponseBody,
        });

    } catch (err) {
        console.error(err); // Log the error for debugging
        res.status(500).json({ message: 'Error sending request', error: err.message });
    }
});
app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});