const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
    workspaceId: {
        type: String,
        required: true,
        index: true
    },
    // The user who performed the action
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    actionType: {
        type: String,
        required: true,
        enum: [
            'create', 'update', 'delete',
            'review_request', 'review_approve', 'review_reject',
            'comment', 'join', 'leave',
            'api_test', 'deploy'
        ]
    },
    // The resource affected
    resourceId: String,
    resourceType: String,
    resourceName: String,

    // Details about the change
    details: {
        type: mongoose.Schema.Types.Mixed
    },

    // For grouping related activities
    groupId: String
}, {
    timestamps: true,
    expires: 30 * 24 * 60 * 60 // Auto-expire logs after 30 days
});

module.exports = mongoose.model('ActivityLog', activityLogSchema);
