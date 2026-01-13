const mongoose = require('mongoose');

const GuideSchema = new mongoose.Schema({
    listingId: {
        type: String,
        ref: 'MarketplaceApi',
        required: true,
        index: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    slug: {
        type: String,
        required: true,
        trim: true
    },
    summary: {
        type: String,
        maxLength: 300
    },
    contentMarkdown: {
        type: String,
        required: true
    },
    order: {
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

// Ensure unique slug per listing
GuideSchema.index({ listingId: 1, slug: 1 }, { unique: true });

module.exports = mongoose.models.Guide || mongoose.model('Guide', GuideSchema);
