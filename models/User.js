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
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);