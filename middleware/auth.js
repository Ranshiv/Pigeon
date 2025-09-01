// middleware/auth.js
const mongoose = require('mongoose');

// Create a consistent temp user ID as a valid ObjectId
const TEMP_USER_ID = new mongoose.Types.ObjectId('507f1f77bcf86cd799439011');

const ensureAuthenticated = (req, res, next) => {
    // For development purposes: automatically authenticate all requests
    // This allows workspace functionality to work properly
    req.isAuthenticated = () => true;
    if (!req.user) {
        req.user = {
            _id: TEMP_USER_ID,
            id: TEMP_USER_ID.toString(),
            name: "Development User",
            email: "dev@pigeon.local",
            displayName: "Development User"
        };
    }
    return next();
};

// JWT Authentication middleware
const authenticateJWT = (req, res, next) => {
    // For development purposes, we'll auto-authenticate
    // In a production environment, this would verify a JWT token
    if (!req.user) {
        req.user = {
            _id: TEMP_USER_ID,
            id: TEMP_USER_ID.toString(),
            name: "Development User",
            email: "dev@pigeon.local",
            displayName: "Development User"
        };
    }
    return next();
};

module.exports = {
    ensureAuthenticated,
    authenticateJWT
};