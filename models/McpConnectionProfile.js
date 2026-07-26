const mongoose = require('mongoose');

const mcpConnectionProfileSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 80
    },
    url: {
        type: String,
        required: true,
        trim: true,
        maxlength: 2048
    },
    protocolVersion: {
        type: String,
        default: '2025-03-26',
        maxlength: 32
    }
}, { timestamps: true });

mcpConnectionProfileSchema.index({ userId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('McpConnectionProfile', mcpConnectionProfileSchema);
