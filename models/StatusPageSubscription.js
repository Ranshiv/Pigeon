// models/StatusPageSubscription.js
const mongoose = require('mongoose');

const statusPageSubscriptionSchema = new mongoose.Schema({
    workspaceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Workspace',
        required: true
    },
    email: {
        type: String,
        required: true
    },
    phone: String, // For SMS notifications
    isActive: {
        type: Boolean,
        default: true
    },
    subscriptionTypes: [{
        type: String,
        enum: ['incident_updates', 'maintenance_windows', 'monitor_alerts', 'weekly_summary'],
        default: ['incident_updates']
    }],
    verificationToken: String,
    isVerified: {
        type: Boolean,
        default: false
    },
    verifiedAt: Date,
    unsubscribeToken: {
        type: String,
        unique: true,
        sparse: true
    }
}, {
    timestamps: true
});

statusPageSubscriptionSchema.index({ workspaceId: 1, email: 1 }, { unique: true });

module.exports = mongoose.model('StatusPageSubscription', statusPageSubscriptionSchema);
