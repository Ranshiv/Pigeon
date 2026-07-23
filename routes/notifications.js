const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const { ensureAuthenticated } = require('../middleware/auth');
const { emitToUser } = require('../utils/socket/socket-server');

const userId = (req) => String(req.user?.id || req.user?._id || '');
const serialize = (notification) => ({
    id: String(notification._id), type: notification.type, severity: notification.severity,
    message: notification.message, workspaceId: notification.workspaceId,
    actorId: notification.actorId, read: notification.read, timestamp: notification.createdAt
});

router.get('/', ensureAuthenticated, async (req, res) => {
    try {
        const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 50, 1), 100);
        const recipientId = userId(req);
        const [notifications, unreadCount] = await Promise.all([
            Notification.find({ recipientId }).sort({ createdAt: -1 }).limit(limit).lean(),
            Notification.countDocuments({ recipientId, read: false })
        ]);
        res.json({ notifications: notifications.map(serialize), unreadCount });
    } catch (error) {
        console.error('Fetch notifications failed:', error);
        res.status(500).json({ message: 'Failed to fetch notifications' });
    }
});

router.patch('/:id/read', ensureAuthenticated, async (req, res) => {
    try {
        const recipientId = userId(req);
        const notification = await Notification.findOneAndUpdate(
            { _id: req.params.id, recipientId }, { $set: { read: true } }, { new: true }
        ).lean();
        if (!notification) return res.status(404).json({ message: 'Notification not found' });
        const payload = { id: String(notification._id), read: true };
        emitToUser(recipientId, 'notificationRead', payload);
        res.json(serialize(notification));
    } catch (error) {
        res.status(400).json({ message: 'Failed to mark notification read' });
    }
});

router.post('/read-all', ensureAuthenticated, async (req, res) => {
    try {
        const recipientId = userId(req);
        await Notification.updateMany({ recipientId, read: false }, { $set: { read: true } });
        emitToUser(recipientId, 'notificationsReadAll', {});
        res.status(204).end();
    } catch (error) {
        res.status(500).json({ message: 'Failed to mark notifications read' });
    }
});

module.exports = router;
