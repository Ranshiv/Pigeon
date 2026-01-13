const mongoose = require('mongoose');

const ForumPostSchema = new mongoose.Schema({
    threadId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ForumThread',
        required: true,
        index: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    body: {
        type: String,
        required: true,
        maxLength: 5000
    },
    isSolution: {
        type: Boolean,
        default: false
    },
    likes: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.models.ForumPost || mongoose.model('ForumPost', ForumPostSchema);
