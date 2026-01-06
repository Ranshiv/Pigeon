// middleware/auth.js
const mongoose = require('mongoose');

// Create a consistent temp user ID as a valid ObjectId
const TEMP_USER_ID = new mongoose.Types.ObjectId('507f1f77bcf86cd799439011');

const ensureAuthenticated = (req, res, next) => {
    const isProd = process.env.NODE_ENV === 'production';

    // In production: require a real authenticated user from passport session.
    if (isProd) {
        if (typeof req.isAuthenticated === 'function' && req.isAuthenticated()) {
            return next();
        }

        // Some internal calls may set req.user directly; accept only if present.
        if (req.user && (req.user.id || req.user._id)) {
            return next();
        }

        return res.status(401).json({ message: 'Authentication required' });
    }

    // Development convenience: auto-authenticate unless explicitly disabled.
    // Set ALLOW_DEV_AUTH_STUB=false to simulate production auth locally.
    const allowStub = String(process.env.ALLOW_DEV_AUTH_STUB || 'true').toLowerCase() !== 'false';
    if (!allowStub) {
        if (typeof req.isAuthenticated === 'function' && req.isAuthenticated()) {
            return next();
        }
        if (req.user && (req.user.id || req.user._id)) {
            return next();
        }
        return res.status(401).json({ message: 'Authentication required (dev stub disabled)' });
    }

    req.isAuthenticated = () => true;
    if (!req.user) {
        req.user = {
            _id: TEMP_USER_ID,
            id: TEMP_USER_ID.toString(),
            name: 'Development User',
            email: 'dev@pigeon.local',
            displayName: 'Development User'
        };
    }
    return next();
};

// JWT Authentication middleware
const authenticateJWT = (req, res, next) => {
    const isProd = process.env.NODE_ENV === 'production';

    // This repo currently does not implement JWT verification.
    // In production, do not auto-authenticate.
    if (isProd) {
        if (req.user && (req.user.id || req.user._id)) return next();
        return res.status(401).json({ message: 'Authentication required' });
    }

    // Development default: stub a user.
    if (!req.user) {
        req.user = {
            _id: TEMP_USER_ID,
            id: TEMP_USER_ID.toString(),
            name: 'Development User',
            email: 'dev@pigeon.local',
            displayName: 'Development User'
        };
    }
    return next();
};

module.exports = {
    ensureAuthenticated,
    authenticateJWT
};