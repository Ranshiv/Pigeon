const mongoose = require('mongoose');

const mcpHistorySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    serverUrl: { type: String, required: true, maxlength: 2048 },
    serverName: { type: String, maxlength: 200 },
    action: {
        type: String,
        enum: ['connect', 'tools/call', 'resources/read', 'prompts/get'],
        required: true
    },
    target: { type: String, maxlength: 512 },
    input: { type: mongoose.Schema.Types.Mixed },
    result: { type: mongoose.Schema.Types.Mixed },
    success: { type: Boolean, required: true },
    error: { type: String, maxlength: 2000 },
    durationMs: { type: Number, min: 0 },
    createdAt: { type: Date, default: Date.now }
});

mcpHistorySchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('McpHistory', mcpHistorySchema);
