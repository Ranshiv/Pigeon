const ForumThread = require('../../server/models/ForumThread');
const ForumPost = require('../../server/models/ForumPost');

class CommunityForums {
    async listThreads(listingId, { page = 1, limit = 20 } = {}) {
        const query = { listingId };
        const skip = (page - 1) * limit;

        const [items, total] = await Promise.all([
            ForumThread.find(query)
                .sort({ isPinned: -1, lastReplyAt: -1 }) // Pinned first, then most active
                .skip(skip)
                .limit(limit)
                .populate('userId', 'displayName profilePicture'),
            ForumThread.countDocuments(query)
        ]);

        return {
            items,
            total,
            page,
            totalPages: Math.ceil(total / limit)
        };
    }

    async getThread(threadId) {
        const thread = await ForumThread.findById(threadId).populate('userId', 'displayName profilePicture');
        if (!thread) throw new Error('Thread not found');

        // Increment view count (fire and forget)
        ForumThread.updateOne({ _id: threadId }, { $inc: { views: 1 } }).exec();

        const posts = await ForumPost.find({ threadId })
            .sort({ createdAt: 1 })
            .populate('userId', 'displayName profilePicture');

        return {
            thread,
            posts
        };
    }

    async createThread(listingId, userId, { title, body, tags }) {
        const thread = new ForumThread({
            listingId,
            userId,
            title,
            body,
            tags
        });
        await thread.save();
        // Seed the opening body as the first post so consumers (and getThread)
        // see the thread's content as posts[0], consistent with a forum model.
        const openingPost = new ForumPost({
            threadId: thread._id,
            userId,
            body
        });
        await openingPost.save();
        thread.replyCount = 1;
        thread.lastReplyAt = new Date();
        await thread.save();
        return thread;
    }

    async replyToThread(threadId, userId, { body }) {
        const thread = await ForumThread.findById(threadId);
        if (!thread) throw new Error('Thread not found');
        if (thread.isLocked) throw new Error('Thread is locked');

        const post = new ForumPost({
            threadId,
            userId,
            body
        });
        await post.save();

        // Update thread stats
        thread.replyCount += 1;
        thread.lastReplyAt = new Date();
        await thread.save();

        return post;
    }
}

module.exports = new CommunityForums();
