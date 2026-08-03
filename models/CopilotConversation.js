const mongoose = require('mongoose');

const sourceSchema = new mongoose.Schema({
    type: { type: String, required: true },
    id: { type: String, default: '' },
    label: { type: String, default: '' },
    deepLink: { type: String, default: '' },
    evidenceId: { type: String, default: '' },
    relation: { type: String, default: '' },
    confidenceReason: { type: String, default: '' }
}, { _id: false });

const messageSchema = new mongoose.Schema({
    role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
    content: { type: String, default: '' },
    citations: { type: [sourceSchema], default: [] },
    contextSnapshot: { type: [mongoose.Schema.Types.Mixed], default: [] },
    findings: { type: [mongoose.Schema.Types.Mixed], default: [] },
    // Structured, redacted UI result retained with the conversation. Keeping
    // this additive preserves existing message consumers while allowing the
    // operations workspace and floating panel to render the same briefing.
    artifact: { type: mongoose.Schema.Types.Mixed, default: null },
    createdAt: { type: Date, default: Date.now }
}, { _id: false });

const conversationSchema = new mongoose.Schema({
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', default: null, index: true },
    title: { type: String, default: 'New Copilot conversation' },
    profileId: { type: String, required: true },
    messages: { type: [messageSchema], default: [] },
    deletedAt: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

conversationSchema.index({ owner: 1, updatedAt: -1 });
conversationSchema.pre('save', function (next) { this.updatedAt = new Date(); next(); });

module.exports = mongoose.model('CopilotConversation', conversationSchema);
