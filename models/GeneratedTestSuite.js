const mongoose = require('mongoose');

const sourceSchema = new mongoose.Schema({
    type: { type: String, required: true },
    id: { type: String, required: true },
    label: { type: String, default: '' },
    collectionId: { type: String, default: '' },
    operationIds: { type: [String], default: [] }
}, { _id: false });

const generatedTestSuiteSchema = new mongoose.Schema({
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    collectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Collection', default: null, index: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, default: '', maxlength: 2000 },
    status: { type: String, enum: ['generating', 'draft', 'approved', 'materialized', 'failed'], default: 'draft' },
    sources: { type: [sourceSchema], default: [] },
    categories: { type: [String], default: [] },
    authProfileIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'TestAuthProfile' }],
    sourceSnapshotHash: { type: String, required: true },
    generatorVersion: { type: String, default: '1.0.0' },
    ai: {
        requested: { type: Boolean, default: false },
        used: { type: Boolean, default: false },
        provider: { type: String, default: '' },
        model: { type: String, default: '' },
        warning: { type: String, default: '' }
    },
    warnings: { type: [String], default: [] },
    caseCount: { type: Number, default: 0 },
    categoryCounts: { type: mongoose.Schema.Types.Mixed, default: {} },
    artifacts: { type: [mongoose.Schema.Types.Mixed], default: [] },
    approvedAt: { type: Date, default: null },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    materializedAt: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

generatedTestSuiteSchema.index({ workspaceId: 1, updatedAt: -1 });
generatedTestSuiteSchema.pre('save', function (next) { this.updatedAt = new Date(); next(); });

module.exports = mongoose.model('GeneratedTestSuite', generatedTestSuiteSchema);
