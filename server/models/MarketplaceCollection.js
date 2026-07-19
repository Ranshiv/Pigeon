const mongoose = require('mongoose');

// Curated collections of marketplace APIs (e.g. "Essential Web APIs").
// Distinct name from models/Collection.js (workspace request-folders).
const MarketplaceCollectionSchema = new mongoose.Schema({
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String },
    author: { displayName: { type: String } },
    stars: { type: Number, default: 0 },
    listingIds: [{ type: String }],
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.MarketplaceCollection ||
    mongoose.model('MarketplaceCollection', MarketplaceCollectionSchema);
