const express = require('express');
const router = express.Router();
const ReviewRequest = require('../models/ReviewRequest');
const ActivityLog = require('../models/ActivityLog');
const Collection = require('../models/Collection');
const { broadcastActivity, getUserSockets } = require('../utils/socket/socket-server');
const EmailService = require('../services/EmailService');
const emailService = new EmailService();

// Middleware to check authentication (simplified)
const ensureAuthenticated = (req, res, next) => {
    if (req.isAuthenticated && req.isAuthenticated()) {
        return next();
    }
    // For development/demo purposes if auth is not fully set up
    // return next(); 
    return res.status(401).json({ error: 'Unauthorized' });
};

// Create a new review request
router.post('/', ensureAuthenticated, async (req, res) => {
    try {
        const { resourceId, resourceType, title, description, reviewers, metadata } = req.body;

        // Create the review request
        const review = new ReviewRequest({
            resourceId,
            resourceType,
            title,
            description,
            requester: req.user._id,
            reviewers: reviewers ? reviewers.map(id => ({ user: id, status: 'pending' })) : [],
            metadata,
            status: 'open'
        });

        await review.save();

        // Log activity
        const activity = await ActivityLog.create({
            workspaceId: req.session.workspaceId || 'default', // Ideally from context
            user: req.user._id,
            actionType: 'review_request',
            resourceId: review._id,
            resourceType: 'review',
            resourceName: title,
            details: {
                resourceRef: resourceId,
                resourceType: resourceType
            }
        });

        // Broadcast populated activity to all connected clients
        const populatedActivity = await ActivityLog.findById(activity._id)
            .populate('user', 'displayName');
        broadcastActivity(populatedActivity);

        // Notify reviewers directly: live socket ping to whoever's online, email fallback for everyone
        try {
            await review.populate('reviewers.user', 'displayName email');
            const requesterName = req.user.displayName || req.user.email || 'Someone';
            const reviewerIds = review.reviewers.map(r => String(r.user._id));
            const sockets = Array.from(getUserSockets().values())
                .filter(u => reviewerIds.includes(String(u.userData?.id)));

            sockets.forEach(({ socket }) => {
                socket.emit('userActivity', {
                    userId: req.user._id,
                    activity: {
                        type: 'review_requested',
                        details: { reviewId: String(review._id), title, requesterName }
                    },
                    timestamp: new Date().toISOString()
                });
            });

            await Promise.allSettled(review.reviewers.map(r => emailService.sendReviewRequestNotification({
                toEmail: r.user.email,
                toName: r.user.displayName,
                requesterName,
                title,
                reviewId: String(review._id)
            })));
        } catch (notifyError) {
            console.error('Error notifying reviewers:', notifyError);
        }

        res.status(201).json(review);
    } catch (err) {
        console.error('Create Review Error:', err);
        res.status(500).json({ error: 'Failed to create review request' });
    }
});

// Update review status (Approve/Reject)
router.patch('/:id/status', ensureAuthenticated, async (req, res) => {
    try {
        const { status, comment } = req.body; // status: 'approved' | 'rejected'
        const reviewId = req.params.id;

        const review = await ReviewRequest.findById(reviewId);
        if (!review) return res.status(404).json({ error: 'Review not found' });

        // Find the reviewer entry for this user
        const reviewerIndex = review.reviewers.findIndex(r => r.user.toString() === req.user._id.toString());

        if (reviewerIndex < 0) {
            return res.status(403).json({ error: 'Only assigned reviewers can approve or reject this review' });
        }

        review.reviewers[reviewerIndex].status = status;
        review.reviewers[reviewerIndex].reviewedAt = new Date();

        // If all reviewers approved, mark main status as approved
        const allApproved = review.reviewers.length > 0 && review.reviewers.every(r => r.status === 'approved');
        if (allApproved) {
            review.status = 'approved';
        } else if (status === 'rejected') {
            review.status = 'rejected';
        }

        await review.save();

        // Log activity
        const activity = await ActivityLog.create({
            workspaceId: 'default',
            user: req.user._id,
            actionType: status === 'approved' ? 'review_approve' : 'review_reject',
            resourceId: review._id,
            resourceType: 'review',
            resourceName: review.title,
            details: { comment }
        });

        const populatedActivity = await ActivityLog.findById(activity._id)
            .populate('user', 'displayName');
        broadcastActivity(populatedActivity);

        res.json(review);
    } catch (err) {
        console.error('Update Review Error:', err);
        res.status(500).json({ error: 'Failed to update review status' });
    }
});

// Update review details (title, description) - Only by requester
router.patch('/:id', ensureAuthenticated, async (req, res) => {
    try {
        const { title, description } = req.body;
        const reviewId = req.params.id;

        const review = await ReviewRequest.findById(reviewId);
        if (!review) return res.status(404).json({ error: 'Review not found' });

        // Only the requester can edit the review details
        if (review.requester.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Only the requester can edit this review' });
        }

        // Update fields
        if (title !== undefined) review.title = title;
        if (description !== undefined) review.description = description;
        review.updatedAt = new Date();

        await review.save();

        // Populate for consistent response
        await review.populate('requester', 'displayName email profilePicture');
        await review.populate('reviewers.user', 'displayName email profilePicture');

        res.json(review);
    } catch (err) {
        console.error('Update Review Error:', err);
        res.status(500).json({ error: 'Failed to update review' });
    }
});

// Get reviews for a workspace or user
router.get('/', ensureAuthenticated, async (req, res) => {
    try {
        const { type } = req.query; // 'assigned' | 'created' | 'all'

        let query = {};
        if (type === 'assigned') {
            query = { 'reviewers.user': req.user._id };
        } else if (type === 'created') {
            query = { requester: req.user._id };
        }

        const reviews = await ReviewRequest.find(query)
            .populate('requester', 'displayName email profilePicture')
            .populate('reviewers.user', 'displayName email profilePicture')
            .sort({ createdAt: -1 });

        res.json(reviews);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch reviews' });
    }
});

module.exports = router;
