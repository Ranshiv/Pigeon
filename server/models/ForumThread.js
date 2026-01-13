const mongoose = require('mongoose');

const ForumThreadSchema = new mongoose.Schema({
    listingId: {
        type: String, // Matches MarketplaceApi.id
        ref: 'MarketplaceApi',
        required: true,
        index: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    title: {
        type: String,
        required: true,
        trim: true,
        maxLength: 200
    },
    body: {
        type: String,
        required: true, // The initial post content
        maxLength: 5000
    },
    views: {
        type: Number,
        default: 0
    },
    replyCount: {
        type: Number,
        default: 0
    },
    lastReplyAt: {
        type: Date,
        default: Date.now
    },
    isPinned: {
        type: Boolean,
        default: false
    },
    isLocked: {
        type: Boolean,
        default: false
    },
    tags: [String],
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.models.ForumThread || mongoose.model('ForumThread', ForumThreadSchema);
