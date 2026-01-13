const Review = require('../../server/models/Review');
const MarketplaceApi = require('../../server/models/MarketplaceApi');

class ReviewService {
    async createReview(listingId, userId, { rating, title, body }) {
        // 1. Create the review
        const review = new Review({
            listingId,
            userId,
            rating,
            title,
            body
        });
        await review.save();

        // 2. Update aggregate stats on the listing
        await this.updateListingStats(listingId);

        return review;
    }

    async getReviews(listingId, { page = 1, limit = 10, sort = 'recent' } = {}) {
        const query = { listingId };
        const sortOptions = {};

        switch (sort) {
            case 'recent': sortOptions.createdAt = -1; break;
            case 'highest': sortOptions.rating = -1; break;
            case 'lowest': sortOptions.rating = 1; break;
            default: sortOptions.createdAt = -1;
        }

        const skip = (page - 1) * limit;

        const [items, total] = await Promise.all([
            Review.find(query)
                .sort(sortOptions)
                .skip(skip)
                .limit(limit)
                .populate('userId', 'displayName profilePicture'),
            Review.countDocuments(query)
        ]);

        // Get aggregate info
        const aggregate = await this.getAggregateStats(listingId);

        return {
            items,
            total,
            page,
            totalPages: Math.ceil(total / limit),
            aggregate
        };
    }

    async deleteReview(reviewId, userId, isAdmin = false) {
        const review = await Review.findById(reviewId);
        if (!review) throw new Error('Review not found');

        if (!isAdmin && review.userId.toString() !== userId.toString()) {
            throw new Error('Unauthorized');
        }

        const listingId = review.listingId;
        await Review.deleteOne({ _id: reviewId });
        await this.updateListingStats(listingId);
    }

    // Helper: Update caching fields on MarketplaceApi
    async updateListingStats(listingId) {
        const stats = await Review.aggregate([
            { $match: { listingId } },
            {
                $group: {
                    _id: null,
                    avgRating: { $avg: '$rating' },
                    count: { $sum: 1 }
                }
            }
        ]);

        const avg = stats.length > 0 ? stats[0].avgRating : 0;
        const count = stats.length > 0 ? stats[0].count : 0;

        await MarketplaceApi.findOneAndUpdate(
            { id: listingId },
            {
                ratingAverage: Math.round(avg * 10) / 10, // Round to 1 decimal
                ratingCount: count
            }
        );
    }

    // Helper: Get just the stats (for UI headers etc)
    async getAggregateStats(listingId) {
        const stats = await Review.aggregate([
            { $match: { listingId } },
            {
                $group: {
                    _id: null,
                    averageRating: { $avg: '$rating' },
                    totalRatings: { $sum: 1 },
                    distribution: {
                        $push: '$rating'
                    }
                }
            }
        ]);

        if (stats.length === 0) {
            return { averageRating: 0, totalRatings: 0, breakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };
        }

        const s = stats[0];
        const breakdown = s.distribution.reduce((acc, r) => {
            acc[r] = (acc[r] || 0) + 1;
            return acc;
        }, { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });

        return {
            averageRating: Math.round(s.averageRating * 10) / 10,
            totalRatings: s.totalRatings,
            breakdown
        };
    }
}

module.exports = new ReviewService();
