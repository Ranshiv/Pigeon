const mongoose = require('mongoose');

const reviewRequestSchema = new mongoose.Schema({
    // The resource being reviewed (e.g., a Request, Collection, or Workspace)
    resourceId: {
        type: String,
        required: true,
        index: true
    },
    resourceType: {
        type: String,
        required: true,
        enum: ['request', 'collection', 'workspace', 'api']
    },
    // The user requesting the review
    requester: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // Users assigned to review
    reviewers: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        status: {
            type: String,
            enum: ['pending', 'approved', 'rejected', 'commented'],
            default: 'pending'
        },
        reviewedAt: Date
    }],
    title: {
        type: String,
        required: true
    },
    description: String,
    status: {
        type: String,
        enum: ['open', 'approved', 'rejected', 'merged', 'closed'],
        default: 'open'
    },
    metadata: {
        type: Map,
        of: mongoose.Schema.Types.Mixed
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('ReviewRequest', reviewRequestSchema);
