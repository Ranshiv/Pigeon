const mongoose = require('mongoose');

const copilotActionSchema = new mongoose.Schema({
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'CopilotConversation', required: true, index: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', default: null },
    kind: { type: String, required: true },
    payload: { type: mongoose.Schema.Types.Mixed, required: true },
    preview: { type: String, default: '' },
    proposalHash: { type: String, required: true },
    status: { type: String, enum: ['pending', 'approved', 'executed', 'rejected', 'failed', 'expired'], default: 'pending', index: true },
    expiresAt: { type: Date, required: true },
    approvedAt: { type: Date, default: null },
    executedAt: { type: Date, default: null },
    error: { type: String, default: '' },
    result: { type: mongoose.Schema.Types.Mixed, default: null },
    createdAt: { type: Date, default: Date.now }
});

copilotActionSchema.index({ owner: 1, status: 1, createdAt: -1 });
module.exports = mongoose.model('CopilotAction', copilotActionSchema);
