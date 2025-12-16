// models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    googleId: { type: String, required: true, unique: true },
    displayName: { type: String, required: true },
    email: { type: String, required: true },
    theme: { type: String, enum: ['light', 'dark'], default: 'light' },
    fontSize: { type: String, default: '16px' },
    // Add profileIcon field
    profileIcon: { type: String, default: null }, // Store the filename, default to null
    // OAuth2 tokens for email sending (from Google OAuth)
    accessToken: { type: String, select: false }, // Don't include by default for security
    refreshToken: { type: String, select: false }, // Don't include by default for security
    tokenExpiry: { type: Date, select: false }, // When access token expires
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);