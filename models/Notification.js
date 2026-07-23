const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    recipientId: { type: String, required: true, index: true },
    workspaceId: { type: String, default: null, index: true },
    type: { type: String, default: 'system' },
    severity: { type: String, enum: ['info', 'warning', 'error'], default: 'info' },
    message: { type: String, required: true },
    actorId: { type: String, default: null },
    read: { type: Boolean, default: false, index: true }
}, { timestamps: true });

notificationSchema.index({ recipientId: 1, createdAt: -1 });
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

module.exports = mongoose.model('Notification', notificationSchema);
