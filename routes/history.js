// routes/history.js
const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const { ensureAuthenticated } = require('../middleware/auth');
const History = require('../models/History');

// Get request history for the authenticated user
router.get('/', ensureAuthenticated, async (req, res) => {
    try {
        const history = await History.find({ userId: req.user.id })
            .sort({ timestamp: -1 })
            .limit(50);

        // Parse test results JSON strings into objects for the frontend
        const historyWithParsedTests = history.map(entry => {
            let parsedEntry = entry.toObject();

            // Parse testResults if it exists and is a string
            if (parsedEntry.testResults && typeof parsedEntry.testResults === 'string') {
                try {
                    parsedEntry.testResults = JSON.parse(parsedEntry.testResults);
                } catch (e) {
                    console.error('Error parsing test results:', e);
                    // If parsing fails, keep the original string
                }
            }

            return parsedEntry;
        });

        res.json(historyWithParsedTests);
    } catch (err) {
        console.error("Error fetching history:", err);
        res.status(500).json({ message: 'Error fetching history', error: err.message });
    }
});

// Get popular APIs (most used in the last week)
router.get('/popular-apis', ensureAuthenticated, async (req, res) => {
    try {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        const popularAPIs = await History.aggregate([
            {
                $match: {
                    timestamp: { $gte: oneWeekAgo }
                }
            },
            {
                $group: {
                    _id: {
                        url: "$url",
                        method: "$method"
                    },
                    count: { $sum: 1 },
                    lastUsed: { $max: "$timestamp" }
                }
            },
            {
                $sort: { count: -1 }
            },
            {
                $limit: 5
            }
        ]);

        res.json(popularAPIs);
    } catch (err) {
        console.error('Error fetching popular APIs:', err);
        res.status(500).json({ message: 'Error fetching popular APIs' });
    }
});

// Delete history entry
router.delete('/:id', ensureAuthenticated, async (req, res) => {
    try {
        const historyId = req.params.id;
        const userId = req.user.id;

        // Only allow deletion of the user's own history entries
        const result = await History.deleteOne({
            _id: historyId,
            userId: userId
        });

        if (result.deletedCount === 0) {
            return res.status(404).json({ message: 'History entry not found or you do not have permission to delete it' });
        }

        res.json({ message: 'History entry deleted successfully' });
    } catch (err) {
        console.error('Error deleting history entry:', err);
        res.status(500).json({ message: 'Error deleting history entry' });
    }
});

// Clear all history for the user
router.delete('/', ensureAuthenticated, async (req, res) => {
    try {
        const userId = req.user.id;

        const result = await History.deleteMany({ userId: userId });

        res.json({
            message: 'History cleared successfully',
            deletedCount: result.deletedCount
        });
    } catch (err) {
        console.error('Error clearing history:', err);
        res.status(500).json({ message: 'Error clearing history' });
    }
});

// Get history by collection
router.get('/collection/:collectionId', ensureAuthenticated, async (req, res) => {
    try {
        const collectionId = req.params.collectionId;
        const userId = req.user.id;

        const history = await History.find({
            userId: userId,
            collectionId: collectionId
        })
            .sort({ timestamp: -1 })
            .limit(50);

        // Parse test results if they exist
        const historyWithParsedTests = history.map(entry => {
            let parsedEntry = entry.toObject();

            if (parsedEntry.testResults && typeof parsedEntry.testResults === 'string') {
                try {
                    parsedEntry.testResults = JSON.parse(parsedEntry.testResults);
                } catch (e) {
                    console.error('Error parsing test results:', e);
                }
            }

            return parsedEntry;
        });

        res.json(historyWithParsedTests);
    } catch (err) {
        console.error('Error fetching collection history:', err);
        res.status(500).json({ message: 'Error fetching collection history' });
    }
});

module.exports = router;