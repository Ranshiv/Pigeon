// models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    googleId: { type: String, required: true, unique: true }, // From Google profile.id
    displayName: { type: String, required: true },
    email: { type: String, required: true },
    // Add theme preference
    theme: { type: String, enum: ['light', 'dark'], default: 'light' },
    // You can add other fields like profile picture URL, etc.
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);