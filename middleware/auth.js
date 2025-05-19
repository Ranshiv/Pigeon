// middleware/auth.js
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

module.exports = {
    ensureAuthenticated,
    authenticateJWT
};