const mongoose = require('mongoose');

// Pricing plans offered by a marketplace listing.
const MarketplacePlanSchema = new mongoose.Schema({
    listingId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    description: { type: String },
    isFree: { type: Boolean, default: false },
    pricePerMonth: { type: Number, default: 0 },
    currency: { type: String, default: 'USD' },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.MarketplacePlan ||
    mongoose.model('MarketplacePlan', MarketplacePlanSchema);
