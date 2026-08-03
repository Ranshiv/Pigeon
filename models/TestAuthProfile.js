const mongoose = require('mongoose');

const testAuthProfileSchema = new mongoose.Schema({
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    roleKey: { type: String, required: true, trim: true, maxlength: 80 },
    environmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Environment', default: null },
    authConfigTemplate: { type: mongoose.Schema.Types.Mixed, default: {} },
    expectedAccess: { type: [String], default: [] },
    description: { type: String, default: '', maxlength: 500 },
    isAnonymous: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

testAuthProfileSchema.index({ workspaceId: 1, roleKey: 1 }, { unique: true });
testAuthProfileSchema.pre('save', function (next) { this.updatedAt = new Date(); next(); });

module.exports = mongoose.model('TestAuthProfile', testAuthProfileSchema);
