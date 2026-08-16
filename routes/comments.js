const express = require('express');
const router = express.Router();
const Comment = require('../models/Comment');
const ActivityLog = require('../models/ActivityLog');
const Collection = require('../models/Collection');
const Request = require('../models/Request');
const { broadcastActivity } = require('../utils/socket/socket-server');

const ensureAuthenticated = (req, res, next) => {
    if (req.isAuthenticated && req.isAuthenticated()) {
        return next();
    }
    return res.status(401).json({ error: 'Unauthorized' });
};

// Documentation is embedded in a collection, so both it and collection comments
// resolve through Collection. This avoids sending an activity to the legacy
// `default` room, whose recipients cannot be determined.
async function resolveResourceWorkspace(resourceId, resourceType) {
    if (resourceType === 'workspace') return resourceId;
    const Model = resourceType === 'request'
        ? Request
        : ['collection', 'documentation'].includes(resourceType)
            ? Collection
            : null;
    if (!Model) return null;
    const resource = await Model.findById(resourceId, 'workspaceId').lean().catch(() => null);
    return resource?.workspaceId ? String(resource.workspaceId) : null;
}

// Create a comment
router.post('/', ensureAuthenticated, async (req, res) => {
    try {
        const { resourceId, resourceType, content, jsonPath, parentId } = req.body;
        const workspaceId = await resolveResourceWorkspace(resourceId, resourceType);

        const comment = new Comment({
            resourceId,
            resourceType,
            content,
            jsonPath,
            parentId,
            author: req.user._id,
            resolved: false // Explicitly force false to prevent auto-resolve issues
        });

        await comment.save();

        // Populate author for immediate UI update
        await comment.populate('author', 'displayName email profilePicture');

        // Log activity using the resource's actual workspace. Unscoped legacy
        // resources remain visible in their activity history but are not pushed
        // to a non-existent shared "default" notification room.
        const activity = await ActivityLog.create({
            workspaceId: workspaceId || 'default',
            user: req.user._id,
            actionType: 'comment',
            resourceId: resourceId,
            resourceType: resourceType,
            resourceName: 'Comment', // Could lookup actual resource name
            details: {
                commentId: comment._id,
                snippet: content.substring(0, 50)
            }
        });

        const populatedActivity = await ActivityLog.findById(activity._id)
            .populate('user', 'displayName');
        broadcastActivity(populatedActivity);

        res.status(201).json(comment);
    } catch (err) {
        console.error('Create Comment Error:', err);
        res.status(500).json({ error: 'Failed to post comment' });
    }
});

// Get comments for a resource
router.get('/:resourceType/:resourceId', ensureAuthenticated, async (req, res) => {
    try {
        const { resourceType, resourceId } = req.params;

        const comments = await Comment.find({ resourceType, resourceId })
            .populate('author', 'displayName email profilePicture')
            .sort({ createdAt: 1 }); // Oldest first for threads

        res.json(comments);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch comments' });
    }
});

// Resolve a comment
router.patch('/:id/resolve', ensureAuthenticated, async (req, res) => {
    try {
        const comment = await Comment.findById(req.params.id);
        if (!comment) return res.status(404).json({ error: 'Comment not found' });

        comment.resolved = true;
        comment.resolvedBy = req.user._id;
        comment.resolvedAt = new Date();

        await comment.save();
        res.json(comment);
    } catch (err) {
        res.status(500).json({ error: 'Failed to resolve comment' });
    }
});

// Unresolve a comment (Re-open)
router.patch('/:id/unresolve', ensureAuthenticated, async (req, res) => {
    try {
        const comment = await Comment.findById(req.params.id);
        if (!comment) return res.status(404).json({ error: 'Comment not found' });

        comment.resolved = false;
        comment.resolvedBy = null; // Use null to clear the field in Mongoose
        comment.resolvedAt = null; // Use null to clear the field

        await comment.save();
        res.json(comment);
    } catch (err) {
        console.error('Unresolve Error:', err);
        res.status(500).json({ error: 'Failed to unresolve comment' });
    }
});

module.exports = router;
