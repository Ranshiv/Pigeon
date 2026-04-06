const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
    // The resource this comment belongs to
    resourceId: {
        type: String,
        required: true,
        index: true
    },
    resourceType: {
        type: String,
        required: true,
        enum: ['request', 'collection', 'review', 'api']
    },
    // For inline comments on JSON structures
    jsonPath: {
        type: String,
        default: null, // null means global comment on the resource
        index: true
    },
    // The user who made the comment
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    content: {
        type: String,
        required: true
    },
    resolved: {
        type: Boolean,
        default: false
    },
    resolvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    resolvedAt: Date,
    // Parent comment for threading
    parentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Comment',
        default: null
    },
    // Reactions to the comment (emoji: [userIds])
    reactions: {
        type: Map,
        of: [mongoose.Schema.Types.ObjectId]
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Comment', commentSchema);
