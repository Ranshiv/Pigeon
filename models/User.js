// models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    googleId: { type: String, required: true, unique: true },
    displayName: { type: String, required: true },
    email: { type: String, required: true },
    theme: { type: String, enum: ['light', 'dark', 'omni', 'black'], default: 'omni' },
    fontSize: { type: String, default: '16px' },
    // Add profileIcon field
    profileIcon: { type: String, default: null }, // Store the filename, default to null
    notificationPreferences: {
        inAppEnabled: { type: Boolean, default: true },
        workspaceActivity: { type: Boolean, default: true },
        mergeRequests: { type: Boolean, default: true },
        monitoring: { type: Boolean, default: true },
        systemFailures: { type: Boolean, default: true }
    },
    // Authorization role for moderation/admin actions. 'user' is the default;
    // 'admin' can approve/reject marketplace submissions.
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    // OAuth2 tokens for email sending (from Google OAuth)
    accessToken: { type: String, select: false }, // Don't include by default for security
    refreshToken: { type: String, select: false }, // Don't include by default for security
    tokenExpiry: { type: Date, select: false }, // When access token expires
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
