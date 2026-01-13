const mongoose = require('mongoose');

const ReviewSchema = new mongoose.Schema({
    listingId: {
        type: String, // Matches MarketplaceApi.id (string ID)
        ref: 'MarketplaceApi',
        required: true,
        index: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    title: {
        type: String,
        trim: true,
        maxLength: 100
    },
    body: {
        type: String,
        required: true,
        trim: true,
        maxLength: 2000
    },
    helpfulCount: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Ensure a user can only review a listing once
ReviewSchema.index({ listingId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.models.Review || mongoose.model('Review', ReviewSchema);
