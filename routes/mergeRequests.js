// routes/mergeRequests.js
const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');

const { ensureAuthenticated } = require('../middleware/auth');
const { getDb } = require('../config/db');

// Approve a merge request
router.post('/:id/approve', ensureAuthenticated, async (req, res) => {
    try {
        const mergeRequestId = req.params.id;
        const db = getDb();

        if (!db) {
            return res.status(500).json({ message: 'Database not initialized' });
        }

        const mr = await db.collection('mergeRequests').findOne({ _id: new ObjectId(mergeRequestId) });
        if (!mr) {
            return res.status(404).json({ message: 'Merge request not found' });
        }

        const sourceId = mr.sourceCollectionId;
        const targetId = mr.targetCollectionId;

        const source = await db.collection('collections').findOne({ _id: new ObjectId(sourceId) });
        const target = await db.collection('collections').findOne({ _id: new ObjectId(targetId) });

        if (!source || !target) {
            return res.status(404).json({ message: 'Source or target collection not found' });
        }

        // Minimal merge strategy for now: overwrite target requests with source requests.
        await db.collection('collections').updateOne(
            { _id: new ObjectId(targetId) },
            {
                $set: {
                    requests: Array.isArray(source.requests) ? source.requests : [],
                    updatedAt: new Date()
                }
            }
        );

        await db.collection('mergeRequests').updateOne(
            { _id: new ObjectId(mergeRequestId) },
            {
                $set: {
                    status: 'approved',
                    updatedAt: new Date(),
                    actionBy: {
                        userId: req.user.id,
                        displayName: req.user.name || req.user.displayName || 'User',
                        email: req.user.email
                    }
                }
            }
        );

        return res.json({
            _id: mergeRequestId,
            status: 'approved'
        });
    } catch (err) {
        console.error('Error approving merge request:', err);
        return res.status(500).json({ message: 'Error approving merge request' });
    }
});

// Reject a merge request
router.post('/:id/reject', ensureAuthenticated, async (req, res) => {
    try {
        const mergeRequestId = req.params.id;
        const db = getDb();

        if (!db) {
            return res.status(500).json({ message: 'Database not initialized' });
        }

        const mr = await db.collection('mergeRequests').findOne({ _id: new ObjectId(mergeRequestId) });
        if (!mr) {
            return res.status(404).json({ message: 'Merge request not found' });
        }

        await db.collection('mergeRequests').updateOne(
            { _id: new ObjectId(mergeRequestId) },
            {
                $set: {
                    status: 'rejected',
                    updatedAt: new Date(),
                    actionBy: {
                        userId: req.user.id,
                        displayName: req.user.name || req.user.displayName || 'User',
                        email: req.user.email
                    }
                }
            }
        );

        return res.json({
            _id: mergeRequestId,
            status: 'rejected'
        });
    } catch (err) {
        console.error('Error rejecting merge request:', err);
        return res.status(500).json({ message: 'Error rejecting merge request' });
    }
});

module.exports = router;

