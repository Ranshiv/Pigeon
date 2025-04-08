const mongoose = require('mongoose');

const collectionSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true 
    },
    description: { 
        type: String, 
        required: true 
    },
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    requests: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Request'
    }],
    stars: {
        type: Number,
        default: 0
    },
    category: {
        type: String,
        enum: ['rest', 'graphql', 'websocket', 'grpc'],
        required: true
    },
    isPublic: {
        type: Boolean,
        default: true
    },
    forkedFrom: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Collection'
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

module.exports = mongoose.model('Collection', collectionSchema);